import * as vscode from 'vscode';
import * as path from 'path';
import { AnnotationParser } from '../parsers/AnnotationParser';
import { EndpointCache } from '../cache/EndpointCache';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/ConfigManager';
import { getLabels } from '../extractor/i18n';
import { ScanStateManager } from '../cache/ScanStateManager';
import { TextProcessor } from '../utils/TextProcessor';
import { RestEndpoint } from '../models/types';

export interface FileScanResult {
    success: boolean;
    endpointCount: number;
}

interface ParsedFileScanResult extends FileScanResult {
    endpoints: RestEndpoint[];
}

/** 单文件已完成解析、等待原子提交的扫描产物。 */
interface CollectedFileScan {
    file: string;
    endpoints: RestEndpoint[];
    endpointCount: number;
    fileVersion: number;
    mtime: number;
    size: number;
}

/**
 * 扫描工作区 Java/Kotlin 源文件并维护端点缓存与会话内增量状态。
 *
 * 工作区和 watcher 扫描在文件元数据稳定时才共同提交端点与扫描记录；读取失败、解析失败
 * 或扫描期间再次变化的文件不会覆盖现有缓存，并保留后续重试资格。
 */
export class FileScanner implements vscode.Disposable {
    private static readonly endpointAnnotationPattern = /@(?:[\w$]+\.)*(?:RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|Path|GET|POST|PUT|DELETE|PATCH)\b/;
    private annotationParser: AnnotationParser;
    private cache: EndpointCache;
    private logger: Logger;
    private configManager: ConfigManager;
    private scanStateManager: ScanStateManager;
    private statusBarItem: vscode.StatusBarItem;
    private scanPromise: Promise<void> | null = null;
    private fullRefreshRequested = false;
    private readonly scanStateEmitter = new vscode.EventEmitter<boolean>();
    readonly onDidChangeScanState = this.scanStateEmitter.event;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private statusBarHideTimer: NodeJS.Timeout | undefined;
    private disposed = false;
    /** 文件事件版本令牌：删除文件时推进，防止在途扫描把旧端点写回 */
    private fileVersions: Map<string, number> = new Map();
    /** watcher 待扫描文件（按文件合并重复事件）与在途任务账本，共用扫描并发上限 */
    private pendingWatcherFiles: Map<string, vscode.Uri> = new Map();
    private inFlightWatcherFiles: Set<string> = new Set();
    private activeWatcherTasks = 0;
    private slotWaiters: Array<() => void> = [];
    private watcherPumpActive = false;
    private watcherTail: Promise<void> = Promise.resolve();

    private lastProgressUpdate: number = 0;
    private progressThrottleMs = 200;
    private scanConcurrency = 15;
    private scannedCount: number = 0;

    constructor(cache: EndpointCache) {
        this.annotationParser = new AnnotationParser();
        this.cache = cache;
        this.logger = Logger.getInstance();
        this.configManager = ConfigManager.getInstance();
        this.scanStateManager = ScanStateManager.getInstance();
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    }

    async scanWorkspace(): Promise<void> {
        if (this.disposed) {
            return;
        }
        if (this.scanPromise) {
            this.logger.info('Scan already in progress, waiting for completion');
            await this.scanPromise;
            return;
        }

        // 默认使用增量扫描（如果有历史记录）
        const hasHistory = this.scanStateManager.hasHistory();
        this.logger.info(`Scan strategy: ${hasHistory ? 'INCREMENTAL (use history)' : 'FULL (no history)'}`);

        this.scanPromise = this.runScanQueue(!hasHistory);
        this.scanStateEmitter.fire(true);
        try {
            await this.scanPromise;
        } finally {
            this.finishScan();
        }
    }

    private finishScan(): void {
        this.scanPromise = null;
        if (!this.disposed) {
            this.scanStateEmitter.fire(false);
        }
    }

    private async runScanQueue(forceInitialScan: boolean): Promise<void> {
        // 已启动的 watcher 任务必须先提交；scanPromise 建立后队列不会再启动新任务。
        // 这样旧 watcher 结果无法覆盖工作区扫描，且两者不会同时占用并发额度。
        while (!this.disposed && this.activeWatcherTasks > 0) {
            await this.waitForWatcherSlot();
        }
        if (this.disposed) {
            return;
        }
        let forceFullScan = forceInitialScan;

        do {
            const resetBeforeScan = this.fullRefreshRequested;
            this.fullRefreshRequested = false;
            if (resetBeforeScan) {
                forceFullScan = true;
            }

            try {
                await this.performScan(forceFullScan);
            } catch (error) {
                if (this.disposed || !this.fullRefreshRequested) {
                    throw error;
                }
                const err = error instanceof Error ? error : new Error(String(error));
                this.logger.error('Scan failed; continuing with queued full refresh', err);
            }
            forceFullScan = false;
        } while (!this.disposed && this.fullRefreshRequested);
    }

    isScanning(): boolean {
        return this.scanPromise !== null;
    }

    /**
     * 等待当前工作区扫描与全部 watcher 队列任务收束，供停用流程使用。
     * 尚在防抖等待中的文件事件也会等到触发并入队列并执行完毕。
     */
    async waitForIdle(): Promise<void> {
        if (this.scanPromise) {
            await this.scanPromise;
        }
        // 防抖定时器尚未触发的事件还没有进入待处理队列，先等其排空再等队列收束
        while (!this.disposed && this.debounceTimers.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        await this.watcherTail;
    }

    /**
     * 执行扫描（支持增量扫描）
     *
     * @param forceFullScan 是否强制全量扫描（默认增量）
     */
    private async performScan(forceFullScan: boolean = false): Promise<void> {
        this.clearStatusBarHideTimer();

        const folderConfigs = this.configManager.getFolderScanConfigs();
        for (const folderConfig of folderConfigs) {
            this.logger.info(`Scan scope [${folderConfig.folder.fsPath}]: ${folderConfig.scanPaths.join(', ')}`);
            this.logger.info(`Exclude patterns [${folderConfig.folder.fsPath}]: ${folderConfig.excludePaths.join(', ')}`);
        }
        if (folderConfigs.length === 0) {
            const config = this.configManager.getScanConfig();
            this.logger.info(`Starting workspace scan with patterns: ${config.scanPaths.join(', ')}`);
            this.logger.info(`Exclude patterns: ${config.excludePaths.join(', ')}`);
        }
        this.logger.info(`Scan mode: ${forceFullScan ? 'FULL' : 'INCREMENTAL'}`);

        // 诊断：检查工作区文件夹
        if (vscode.workspace.workspaceFolders) {
            this.logger.info(`Workspace folders: ${vscode.workspace.workspaceFolders.map(f => f.uri.fsPath).join(', ')}`);
        } else {
            this.logger.warning('No workspace folder found');
        }

        // 增量扫描统计
        const stats = this.scanStateManager.getStats();
        if (!forceFullScan && stats.lastScanTime) {
            this.logger.info(`Previous scan: ${stats.totalFiles} files, ${stats.totalEndpoints} endpoints, last scan: ${new Date(stats.lastScanTime).toLocaleString()}`);
        }

        this.showProgress(getLabels().scanProgress, 0, 0);

        const discovery = await this.discoverCandidateFiles();
        if (this.disposed) {
            return;
        }

        const uniqueFiles = this.deduplicateUris(discovery.files);
        const duplicateFiles = discovery.files.length - uniqueFiles.length;
        const totalFiles = uniqueFiles.length;

        this.logger.info(`Total unique files to scan: ${totalFiles}${duplicateFiles > 0 ? ` (${duplicateFiles} duplicate matches removed)` : ''}`);

        if (totalFiles === 0) {
            this.logger.info('No files found to scan');
            this.logger.warning('Possible reasons: 1) No Java/Kotlin files in workspace 2) All files excluded 3) Workspace folder not set correctly');
            if (discovery.trusted) {
                this.reconcileRemovedFiles([], discovery.unknownFolders);
            } else {
                // scanPaths 解析为空时没有发生真实发现，保留已索引端点等待配置恢复
                this.logger.info('Scan scope resolved to no include patterns; keeping existing indexed endpoints');
            }
            this.showProgress(getLabels().scanNoFiles, 0, 0, true);
            return;
        }

        // 过滤需要扫描的文件（并发检查 mtime）
        const candidates = uniqueFiles.filter(f => !/[/\\]\.git([/\\]|$)/.test(f.fsPath));

        let filesToScan: vscode.Uri[];
        let skippedFiles: number;
        if (!forceFullScan) {
            const results = await this.runWithConcurrency(
                candidates.map((file) => async () => ({
                    file,
                    ...await this.scanStateManager.needsScan(file.fsPath)
                })),
                this.scanConcurrency
            );
            const scanned = results
                .filter(r => r.needsScan)
                .map(r => r.file);
            filesToScan = scanned;
            skippedFiles = candidates.length - scanned.length;
        } else {
            filesToScan = candidates;
            skippedFiles = 0;
        }

        // 并发扫描
        this.scannedCount = 0;
        let filesWithEndpoints = 0;
        const collectedScans: CollectedFileScan[] = [];

        const scanOneFile = async (file: vscode.Uri): Promise<void> => {
            if (this.disposed) {
                return;
            }
            const collected = await this.collectFileScan(file);
            if (this.disposed) {
                return;
            }
            if (collected) {
                collectedScans.push(collected);
                if (collected.endpointCount > 0) {
                    filesWithEndpoints++;
                }
            }

            this.scannedCount++;
            this.showProgressThrottled(getLabels().scanProgress, this.scannedCount, filesToScan.length);
        };

        // 使用并发控制执行扫描，解析完成后一批变更仅压缩一次缓存数组
        await this.runWithConcurrency(filesToScan.map(f => () => scanOneFile(f)), this.scanConcurrency);
        if (this.disposed) {
            return;
        }
        await this.commitFileScans(collectedScans);

        // 发现结果对账：清理已从扫描范围消失的已索引文件（删除事件遗漏时增量刷新可自愈）
        this.reconcileRemovedFiles(candidates, discovery.unknownFolders);

        const endpointCount = this.cache.size();
        const scannedFiles = filesToScan.length;
        this.logger.info(`Scan complete. Mode: ${forceFullScan ? 'FULL' : 'INCREMENTAL'}, Scanned ${scannedFiles} files, Skipped ${skippedFiles} files, ${filesWithEndpoints} files with endpoints, total ${endpointCount} endpoints`);

        const labels = getLabels();
        const message = skippedFiles > 0
            ? labels.scanCompleteIncremental.replace('{0}', String(scannedFiles)).replace('{1}', String(skippedFiles)).replace('{2}', String(endpointCount))
            : labels.scanCompleteFull.replace('{0}', String(endpointCount));

        this.showProgress(message, totalFiles, totalFiles, true);

        this.scheduleStatusBarHide();
    }

    /**
     * 发现扫描候选文件。
     *
     * 多根工作区按每个根目录各自的 scanPaths/excludePaths 独立发现（各根配置互不
     * 合并），结果统一去重；未初始化根目录时回退到全局合并配置的单一查询。
     *
     * trusted 表示至少一个范围完成发现；unknownFolders 记录未执行发现的根，
     * 对账时须保留这些根内的缓存。
     */
    private async discoverCandidateFiles(): Promise<{ files: vscode.Uri[]; trusted: boolean; unknownFolders: string[] }> {
        const folderConfigs = this.configManager.getFolderScanConfigs();
        if (folderConfigs.length === 0) {
            const config = this.configManager.getScanConfig();
            if (config.scanPaths.length === 0) {
                return { files: [], trusted: false, unknownFolders: [] };
            }
            const files = await vscode.workspace.findFiles(
                this.combineGlobPatterns(config.scanPaths),
                config.excludePaths.length > 0 ? this.combineGlobPatterns(config.excludePaths) : undefined
            );
            return { files, trusted: true, unknownFolders: [] };
        }

        const discovered: vscode.Uri[] = [];
        const unknownFolders: string[] = [];
        let trusted = false;
        for (const folderConfig of folderConfigs) {
            if (folderConfig.scanPaths.length === 0) {
                unknownFolders.push(folderConfig.folder.fsPath);
                continue;
            }
            trusted = true;
            const include = new vscode.RelativePattern(
                folderConfig.folder,
                this.combineGlobPatterns(folderConfig.scanPaths)
            );
            const exclude = folderConfig.excludePaths.length > 0
                ? new vscode.RelativePattern(folderConfig.folder, this.combineGlobPatterns(folderConfig.excludePaths))
                : undefined;
            discovered.push(...await vscode.workspace.findFiles(include, exclude));
            if (this.disposed) {
                return { files: discovered, trusted, unknownFolders };
            }
        }
        return { files: discovered, trusted, unknownFolders };
    }

    private combineGlobPatterns(patterns: string[]): string {
        return patterns.length === 1 ? patterns[0] : `{${patterns.join(',')}}`;
    }

    /**
     * 并发控制执行器
     */
    private deduplicateUris(files: vscode.Uri[]): vscode.Uri[] {
        const seen = new Set<string>();
        const uniqueFiles: vscode.Uri[] = [];

        for (const file of files) {
            const key = this.normalizeFsPath(file.fsPath);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            uniqueFiles.push(file);
        }

        return uniqueFiles;
    }

    private normalizeFsPath(filePath: string): string {
        return process.platform === 'win32' ? filePath.toLowerCase() : filePath;
    }

    /**
     * 将已索引文件与本次发现的候选集合对账，移除确定已不在扫描范围内的文件。
     *
     * 发现失败（findFiles 抛出异常）不会进入此路径；空扫描范围对应的根不参与
     * 对账。移除统一走一次批量缓存更新。
     */
    private reconcileRemovedFiles(candidates: vscode.Uri[], unknownFolders: string[]): void {
        if (this.disposed) {
            return;
        }
        const discoveredFiles = new Set(candidates.map(file => this.normalizeFsPath(file.fsPath)));
        const removedFiles: string[] = [];

        const indexedFiles = new Set([...this.scanStateManager.getAllScannedFiles(), ...this.cache.getIndexedFiles()]);
        for (const recordedFile of indexedFiles) {
            const normalizedFile = this.normalizeFsPath(recordedFile);
            if (unknownFolders.some(folder => {
                const relative = path.relative(this.normalizeFsPath(folder), normalizedFile);
                return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
            })) {
                continue;
            }
            if (discoveredFiles.has(this.normalizeFsPath(recordedFile))) {
                continue;
            }
            removedFiles.push(recordedFile);
        }

        if (removedFiles.length === 0) {
            return;
        }

        this.cache.updateFiles(removedFiles.map(file => ({ file, endpoints: [] })));
        for (const recordedFile of removedFiles) {
            this.scanStateManager.removeRecord(recordedFile);
            this.bumpFileVersion(recordedFile);
        }
        this.logger.info(`Reconciled ${removedFiles.length} indexed file(s) no longer present in the scan scope`);
    }

    private bumpFileVersion(filePath: string): void {
        this.fileVersions.set(filePath, (this.fileVersions.get(filePath) ?? 0) + 1);
    }

    private async runWithConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
        const results: T[] = new Array(tasks.length);
        let index = 0;
        const worker = async () => {
            while (!this.disposed && index < tasks.length) {
                const currentIndex = index++;
                results[currentIndex] = await tasks[currentIndex]();
            }
        };
        const workers = Array.from(
            { length: Math.min(concurrency, tasks.length) },
            () => worker()
        );
        await Promise.all(workers);
        return results;
    }

    /**
     * 读取并解析文件但不修改正式缓存，用于在文件元数据稳定后再原子提交扫描结果。
     *
     * @param uri 待解析的 Java 或 Kotlin 文件
     * @returns 解析状态、端点数量和待提交端点；失败时端点列表为空
     */
    private async parseFile(uri: vscode.Uri): Promise<ParsedFileScanResult> {
        try {
            if (this.disposed) {
                return { success: false, endpointCount: 0, endpoints: [] };
            }
            const filePath = uri.fsPath;

            if (!filePath.endsWith('.java') && !filePath.endsWith('.kt')) {
                return { success: true, endpointCount: 0, endpoints: [] };
            }

            // 异步读取文件内容，避免阻塞 Extension Host
            const content = await TextProcessor.readFileText(uri);
            if (this.disposed) {
                return { success: false, endpointCount: 0, endpoints: [] };
            }

            const parsed = FileScanner.endpointAnnotationPattern.test(content)
                ? this.annotationParser.parseFileResult(content, filePath)
                : { success: true, endpoints: [] };
            return { success: parsed.success, endpointCount: parsed.endpoints.length, endpoints: parsed.endpoints };

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed: ${uri.fsPath}`, err);
            return { success: false, endpointCount: 0, endpoints: [] };
        }
    }

    /**
     * 读取并校验单个文件，返回待提交的扫描产物但不修改缓存。
     *
     * 解析前后分别读取修改时间与文件大小，仅在两次元数据一致时视为可提交；
     * 扫描期间文件发生变化或元数据读取失败时保留现有缓存与重试资格。
     */
    private async collectFileScan(uri: vscode.Uri): Promise<CollectedFileScan | null> {
        try {
            const fileVersion = this.fileVersions.get(uri.fsPath) ?? 0;
            const before = await vscode.workspace.fs.stat(uri);
            const result = await this.parseFile(uri);
            if (!result.success || this.disposed) {
                if (!this.disposed) { this.scanStateManager.removeRecord(uri.fsPath); }
                return null;
            }

            const after = await vscode.workspace.fs.stat(uri);
            if (before.mtime !== after.mtime || before.size !== after.size) {
                this.scanStateManager.removeRecord(uri.fsPath);
                this.logger.info(`File changed during scan; retry required: ${uri.fsPath}`);
                return null;
            }

            return {
                file: uri.fsPath,
                endpoints: result.endpoints,
                endpointCount: result.endpointCount,
                fileVersion,
                mtime: after.mtime,
                size: after.size
            };
        } catch (error) {
            this.scanStateManager.removeRecord(uri.fsPath);
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warning(`Unable to record scan state: ${uri.fsPath} (${message})`);
            return null;
        }
    }

    /**
     * 提交前校验版本令牌：扫描期间收到删除事件的文件不允许把旧端点写回。
     */
    private isCollectedScanCurrent(collected: CollectedFileScan): boolean {
        return !this.disposed && (this.fileVersions.get(collected.file) ?? 0) === collected.fileVersion;
    }

    private async commitFileScans(collectedScans: CollectedFileScan[]): Promise<void> {
        const committable = collectedScans.filter(collected => {
            if (!this.isCollectedScanCurrent(collected)) {
                this.logger.info(`File removed during scan; dropping stale result: ${collected.file}`);
                return false;
            }
            return true;
        });
        if (committable.length === 0) {
            return;
        }

        this.cache.updateFiles(committable.map(collected => ({
            file: collected.file,
            endpoints: collected.endpoints
        })));
        await Promise.all(committable.map(collected =>
            this.scanStateManager.recordScan(collected.file, collected.endpointCount, collected.mtime, collected.size)
        ));
    }

    /**
     * 扫描单个源码文件，并仅在解析成功后记录当前文件元数据。
     *
     * 解析前后分别读取修改时间与文件大小，仅在两次元数据一致时才同时提交端点缓存和扫描
     * 状态。扫描期间文件发生变化或元数据读取失败时不覆盖现有缓存，并保留为待扫描状态。
     *
     * @param uri 待扫描的 Java 或 Kotlin 文件
     * @returns 扫描是否成功以及发现的端点数量
     */
    private async scanFileAndRecord(uri: vscode.Uri): Promise<FileScanResult> {
        try {
            const collected = await this.collectFileScan(uri);
            if (!collected) {
                return { success: false, endpointCount: 0 };
            }
            if (!this.isCollectedScanCurrent(collected)) {
                this.logger.info(`File removed during scan; dropping stale result: ${collected.file}`);
                return { success: false, endpointCount: 0 };
            }

            this.cache.updateFile(collected.file, collected.endpoints);
            await this.scanStateManager.recordScan(
                collected.file,
                collected.endpointCount,
                collected.mtime,
                collected.size
            );
            return { success: true, endpointCount: collected.endpointCount };
        } catch (error) {
            this.scanStateManager.removeRecord(uri.fsPath);
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warning(`Unable to record scan state: ${uri.fsPath} (${message})`);
            return { success: false, endpointCount: 0 };
        }
    }

    scanFileDebounced(uri: vscode.Uri, delay: number = 500): void {
        const filePath = uri.fsPath;
        this.clearDebounceTimer(filePath);

        const timer = setTimeout(() => {
            this.debounceTimers.delete(filePath);
            this.enqueueWatcherScan(uri);
        }, delay);

        this.debounceTimers.set(filePath, timer);
    }

    /**
     * 将防抖后的 watcher 事件并入共享有界队列；同文件只保留一个待执行任务，
     * 且与工作区扫描共用并发上限，避免大量不同文件同时打满文件系统。
     */
    private enqueueWatcherScan(uri: vscode.Uri): void {
        if (this.disposed) {
            return;
        }
        this.pendingWatcherFiles.set(uri.fsPath, uri);
        if (!this.watcherPumpActive) {
            this.watcherPumpActive = true;
            this.watcherTail = this.pumpWatcherQueue();
        }
    }

    private async pumpWatcherQueue(): Promise<void> {
        try {
            while (!this.disposed && (this.pendingWatcherFiles.size > 0 || this.activeWatcherTasks > 0)) {
                if (this.pendingWatcherFiles.size === 0) {
                    await this.waitForWatcherSlot();
                    continue;
                }

                // 工作区扫描进行中：变更保留在待处理集合，等待当前轮结束后再执行
                if (this.scanPromise) {
                    await this.scanPromise.catch(() => undefined);
                    if (this.disposed) {
                        return;
                    }
                    continue;
                }

                let launched = false;
                for (const [filePath, uri] of Array.from(this.pendingWatcherFiles)) {
                    if (this.activeWatcherTasks >= this.scanConcurrency) {
                        break;
                    }
                    if (this.inFlightWatcherFiles.has(filePath)) {
                        continue;
                    }
                    this.pendingWatcherFiles.delete(filePath);
                    this.inFlightWatcherFiles.add(filePath);
                    this.activeWatcherTasks++;
                    launched = true;
                    void this.runWatcherFileScan(uri);
                }

                if (!launched && this.activeWatcherTasks === 0) {
                    break;
                }
                await this.waitForWatcherSlot();
            }
        } finally {
            this.watcherPumpActive = false;
            if (!this.disposed && this.pendingWatcherFiles.size > 0) {
                this.watcherPumpActive = true;
                this.watcherTail = this.pumpWatcherQueue();
            }
        }
    }

    private async runWatcherFileScan(uri: vscode.Uri): Promise<void> {
        const filePath = uri.fsPath;
        try {
            await this.scanFileAndRecord(uri);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Watcher scan failed: ${filePath}`, err);
        } finally {
            this.inFlightWatcherFiles.delete(filePath);
            this.activeWatcherTasks--;
            this.notifyWatcherSlots();
        }
    }

    private waitForWatcherSlot(): Promise<void> {
        return new Promise(resolve => this.slotWaiters.push(resolve));
    }

    private notifyWatcherSlots(): void {
        const waiters = this.slotWaiters;
        this.slotWaiters = [];
        for (const waiter of waiters) {
            waiter();
        }
    }

    removeFile(uri: vscode.Uri): void {
        const filePath = uri.fsPath;
        this.logger.info(`Removing file from cache: ${filePath}`);
        this.cache.removeByFile(filePath);
        this.scanStateManager.removeRecord(filePath);

        // 推进版本令牌，使该文件在途的扫描结果无法再写回缓存
        this.bumpFileVersion(filePath);

        this.clearDebounceTimer(filePath);
        this.pendingWatcherFiles.delete(filePath);
    }

    private showProgress(message: string, current: number, total: number, hide: boolean = false): void {
        if (this.disposed) {
            return;
        }
        if (hide) {
            this.statusBarItem.text = message;
            this.statusBarItem.show();
        } else {
            const progress = total > 0 ? `${current}/${total}` : '';
            this.statusBarItem.text = getLabels().statusBarProgress.replace('{0}', message).replace('{1}', progress);
            this.statusBarItem.show();
        }
    }

    private clearStatusBarHideTimer(): void {
        if (this.statusBarHideTimer) {
            clearTimeout(this.statusBarHideTimer);
            this.statusBarHideTimer = undefined;
        }
    }

    private scheduleStatusBarHide(): void {
        const hideTimer = setTimeout(() => {
            if (!this.disposed) {
                this.statusBarItem.hide();
            }
            if (this.statusBarHideTimer === hideTimer) {
                this.statusBarHideTimer = undefined;
            }
        }, 3000);
        this.statusBarHideTimer = hideTimer;
    }

    private clearDebounceTimer(filePath: string): void {
        const timer = this.debounceTimers.get(filePath);
        if (!timer) {
            return;
        }
        clearTimeout(timer);
        this.debounceTimers.delete(filePath);
    }

    /**
     * 节流版状态栏更新：避免每个文件都触发 UI 重绘
     */
    private showProgressThrottled(message: string, current: number, total: number): void {
        const now = Date.now();
        if (now - this.lastProgressUpdate < this.progressThrottleMs && current < total) {
            return;
        }
        this.lastProgressUpdate = now;
        this.showProgress(message, current, total);
    }

    /**
     * 刷新端点（默认增量刷新）
     *
     * @param forceFullScan 是否强制全量刷新
     */
    refresh(forceFullScan: boolean = false): Promise<void> {
        this.logger.info(`Manual refresh triggered (${forceFullScan ? 'FULL' : 'INCREMENTAL'})`);

        if (forceFullScan) {
            this.fullRefreshRequested = true;
        }

        return this.scanWorkspace();
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.statusBarItem.dispose();
        this.scanStateEmitter.dispose();

        this.clearStatusBarHideTimer();

        this.clearAllDebounceTimers();
        this.pendingWatcherFiles.clear();
        this.notifyWatcherSlots();
    }

    private clearAllDebounceTimers(): void {
        for (const filePath of this.debounceTimers.keys()) {
            this.clearDebounceTimer(filePath);
        }
    }
}
