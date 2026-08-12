import * as vscode from 'vscode';
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
        let forceFullScan = forceInitialScan;

        do {
            const resetBeforeScan = this.fullRefreshRequested;
            this.fullRefreshRequested = false;
            if (resetBeforeScan) {
                this.cache.clear();
                this.scanStateManager.clearAll();
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

    waitForIdle(): Promise<void> {
        return this.scanPromise ?? Promise.resolve();
    }

    /**
     * 执行扫描（支持增量扫描）
     *
     * @param forceFullScan 是否强制全量扫描（默认增量）
     */
    private async performScan(forceFullScan: boolean = false): Promise<void> {
        this.clearStatusBarHideTimer();
        const config = this.configManager.getScanConfig();
        const scanPatterns = config.scanPaths;
        const excludePatterns = config.excludePaths;

        this.logger.info(`Starting workspace scan with patterns: ${scanPatterns.join(', ')}`);
        this.logger.info(`Exclude patterns: ${excludePatterns.join(', ')}`);
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

        // 将多个 include 合并为一次文件系统查询，保留后续去重作为安全边界。
        const excludePattern = excludePatterns.length > 0 ? `{${excludePatterns.join(',')}}` : undefined;
        const includePattern = scanPatterns.length === 1
            ? scanPatterns[0]
            : `{${scanPatterns.join(',')}}`;
        const allFiles = await vscode.workspace.findFiles(includePattern, excludePattern);
        if (this.disposed) {
            return;
        }

        const uniqueFiles = this.deduplicateUris(allFiles);
        const duplicateFiles = allFiles.length - uniqueFiles.length;
        const totalFiles = uniqueFiles.length;

        this.logger.info(`Total unique files to scan: ${totalFiles}${duplicateFiles > 0 ? ` (${duplicateFiles} duplicate matches removed)` : ''}`);

        if (totalFiles === 0) {
            this.logger.info('No files found to scan');
            this.logger.warning('Possible reasons: 1) No Java/Kotlin files in workspace 2) All files excluded 3) Workspace folder not set correctly');
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

        const scanOneFile = async (file: vscode.Uri): Promise<void> => {
            if (this.disposed) {
                return;
            }
            const result = await this.scanFileAndRecord(file);
            if (this.disposed) {
                return;
            }
            if (result.endpointCount > 0) {
                filesWithEndpoints++;
            }

            this.scannedCount++;
            this.showProgressThrottled(getLabels().scanProgress, this.scannedCount, filesToScan.length);
        };

        // 使用并发控制执行扫描
        await this.runWithConcurrency(filesToScan.map(f => () => scanOneFile(f)), this.scanConcurrency);
        if (this.disposed) {
            return;
        }

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
     * 读取并解析单个源码文件，成功后整体替换该文件的端点缓存。
     *
     * 该入口适用于无需记录增量元数据的直接扫描；读取或解析失败时保留已有缓存，交由后续
     * 文件事件或刷新重试。
     *
     * @param uri 待扫描的 Java 或 Kotlin 文件
     * @returns 扫描是否成功以及发现的端点数量
     */
    async scanFile(uri: vscode.Uri): Promise<FileScanResult> {
        const result = await this.parseFile(uri);
        if (result.success && !this.disposed) {
            this.cache.updateFile(uri.fsPath, result.endpoints);
        }
        return { success: result.success, endpointCount: result.endpointCount };
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

            const endpoints = FileScanner.endpointAnnotationPattern.test(content)
                ? this.annotationParser.parseFile(content, filePath)
                : [];
            return { success: true, endpointCount: endpoints.length, endpoints };

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed: ${uri.fsPath}`, err);
            return { success: false, endpointCount: 0, endpoints: [] };
        }
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
            const before = await vscode.workspace.fs.stat(uri);
            const result = await this.parseFile(uri);
            if (!result.success || this.disposed) {
                return { success: result.success, endpointCount: result.endpointCount };
            }

            const after = await vscode.workspace.fs.stat(uri);
            if (before.mtime !== after.mtime || before.size !== after.size) {
                this.scanStateManager.removeRecord(uri.fsPath);
                this.logger.info(`File changed during scan; retry required: ${uri.fsPath}`);
                return { success: false, endpointCount: 0 };
            }

            this.cache.updateFile(uri.fsPath, result.endpoints);
            await this.scanStateManager.recordScan(
                uri.fsPath,
                result.endpointCount,
                after.mtime,
                after.size
            );
            return { success: true, endpointCount: result.endpointCount };
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
            (async () => {
                if (this.disposed) {
                    return;
                }
                if (this.scanPromise) {
                    await this.scanPromise;
                }
                if (this.disposed) {
                    return;
                }
                await this.scanFileAndRecord(uri);
            })().catch(err => this.logger.error(`Debounced scan failed: ${uri.fsPath}`, err));
        }, delay);

        this.debounceTimers.set(filePath, timer);
    }

    removeFile(uri: vscode.Uri): void {
        const filePath = uri.fsPath;
        this.logger.info(`Removing file from cache: ${filePath}`);
        this.cache.removeByFile(filePath);
        this.scanStateManager.removeRecord(filePath);

        this.clearDebounceTimer(filePath);
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
    }

    private clearAllDebounceTimers(): void {
        for (const filePath of this.debounceTimers.keys()) {
            this.clearDebounceTimer(filePath);
        }
    }
}
