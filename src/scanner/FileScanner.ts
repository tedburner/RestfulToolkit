import * as vscode from 'vscode';
import { AnnotationParser } from '../parsers/AnnotationParser';
import { EndpointCache } from '../cache/EndpointCache';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/ConfigManager';
import { getLabels } from '../extractor/i18n';
import { ScanStateManager } from '../cache/ScanStateManager';
import { TextProcessor } from '../utils/TextProcessor';

export class FileScanner implements vscode.Disposable {
    private annotationParser: AnnotationParser;
    private cache: EndpointCache;
    private logger: Logger;
    private configManager: ConfigManager;
    private scanStateManager: ScanStateManager;
    private statusBarItem: vscode.StatusBarItem;
    private scanPromise: Promise<void> | null = null;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

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
        if (this.scanPromise) {
            this.logger.info('Scan already in progress, waiting for completion');
            await this.scanPromise;
            return;
        }

        // 默认使用增量扫描（如果有历史记录）
        const hasHistory = this.scanStateManager.hasHistory();
        this.logger.info(`Scan strategy: ${hasHistory ? 'INCREMENTAL (use history)' : 'FULL (no history)'}`);

        this.scanPromise = this.performScan(!hasHistory);
        try {
            await this.scanPromise;
        } finally {
            this.scanPromise = null;
        }
    }

    /**
     * 执行扫描（支持增量扫描）
     *
     * @param forceFullScan 是否强制全量扫描（默认增量）
     */
    private async performScan(forceFullScan: boolean = false): Promise<void> {
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

        // 一次性收集所有文件（避免重复调用 findFiles）
        const excludePattern = excludePatterns.length > 0 ? `{${excludePatterns.join(',')}}` : undefined;
        const allFiles: vscode.Uri[] = [];
        const patternFileCounts: Map<string, number> = new Map();

        for (const pattern of scanPatterns) {
            const files = await vscode.workspace.findFiles(pattern, excludePattern);
            patternFileCounts.set(pattern, files.length);
            allFiles.push(...files);
        }

        const uniqueFiles = this.deduplicateUris(allFiles);
        const duplicateFiles = allFiles.length - uniqueFiles.length;
        const totalFiles = uniqueFiles.length;

        this.logger.info(`Files found per pattern: ${Array.from(patternFileCounts.entries()).map(([p, c]) => `${p}:${c}`).join(', ')}`);
        this.logger.info(`Total unique files to scan: ${totalFiles}${duplicateFiles > 0 ? ` (${duplicateFiles} duplicate matches removed)` : ''}`);

        if (totalFiles === 0) {
            this.logger.info('No files found to scan');
            this.logger.warning('Possible reasons: 1) No Java/Kotlin files in workspace 2) All files excluded 3) Workspace folder not set correctly');
            this.showProgress(getLabels().scanNoFiles, 0, 0, true);
            return;
        }

        // 过滤需要扫描的文件（并发检查 mtime）
        const candidates = uniqueFiles.filter(f => !/[/\\]\.git([/\\]|$)/.test(f.fsPath));

        let filesToScan: { file: vscode.Uri; mtime: number }[];
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
                .map(r => ({ file: r.file, mtime: r.mtime! }));
            filesToScan = scanned;
            skippedFiles = candidates.length - scanned.length;
        } else {
            filesToScan = candidates.map(f => ({ file: f, mtime: 0 }));
            skippedFiles = 0;
        }

        // 并发扫描
        this.scannedCount = 0;
        let filesWithEndpoints = 0;

        const scanOneFile = async (entry: { file: vscode.Uri; mtime: number }): Promise<void> => {
            const filePath = entry.file.fsPath;

            // 清除旧缓存（如果之前有扫描过）
            const previousEndpoints = this.cache.getByFile(filePath);
            if (previousEndpoints.length > 0) {
                this.cache.removeByFile(filePath);
            }

            const endpointCountBefore = this.cache.size();
            await this.scanFile(entry.file);
            const endpointCountAfter = this.cache.size();

            const endpointsFound = endpointCountAfter - endpointCountBefore;
            if (endpointsFound > 0) {
                filesWithEndpoints++;
                this.logger.info(`Found ${endpointsFound} endpoints in: ${filePath}`);
            }

            // 记录扫描结果，复用 needsScan 阶段获取的 mtime
            await this.scanStateManager.recordScan(filePath, endpointsFound, entry.mtime || Date.now());

            this.scannedCount++;
            this.showProgressThrottled(getLabels().scanProgress, this.scannedCount, filesToScan.length);
        };

        // 使用并发控制执行扫描
        await this.runWithConcurrency(filesToScan.map(f => () => scanOneFile(f)), this.scanConcurrency);

        // 保存扫描状态
        this.scanStateManager.saveState();

        const endpointCount = this.cache.size();
        const scannedFiles = filesToScan.length;
        this.logger.info(`Scan complete. Mode: ${forceFullScan ? 'FULL' : 'INCREMENTAL'}, Scanned ${scannedFiles} files, Skipped ${skippedFiles} files, ${filesWithEndpoints} files with endpoints, total ${endpointCount} endpoints`);

        const labels = getLabels();
        const message = skippedFiles > 0
            ? labels.scanCompleteIncremental.replace('{0}', String(scannedFiles)).replace('{1}', String(skippedFiles)).replace('{2}', String(endpointCount))
            : labels.scanCompleteFull.replace('{0}', String(endpointCount));

        this.showProgress(message, totalFiles, totalFiles, true);

        setTimeout(() => {
            this.statusBarItem.hide();
        }, 3000);
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
            while (index < tasks.length) {
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

    async scanFile(uri: vscode.Uri): Promise<void> {
        try {
            const filePath = uri.fsPath;

            if (!filePath.endsWith('.java') && !filePath.endsWith('.kt')) {
                return;
            }

            // 异步读取文件内容，避免阻塞 Extension Host
            const content = await TextProcessor.readFileText(uri);

            const endpoints = this.annotationParser.parseFile(content, filePath);

            if (endpoints.length > 0) {
                this.cache.updateFile(filePath, endpoints);
                this.logger.info(`✓ ${filePath}: ${endpoints.length} endpoints`);
            }

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed: ${uri.fsPath}`, err);
        }
    }

    scanFileDebounced(uri: vscode.Uri, delay: number = 500): void {
        const filePath = uri.fsPath;

        if (this.debounceTimers.has(filePath)) {
            clearTimeout(this.debounceTimers.get(filePath)!);
        }

        const timer = setTimeout(() => {
            this.debounceTimers.delete(filePath);
            (async () => {
                if (this.scanPromise) {
                    await this.scanPromise;
                }
                await this.scanFile(uri);
            })().catch(err => this.logger.error(`Debounced scan failed: ${uri.fsPath}`, err));
        }, delay);

        this.debounceTimers.set(filePath, timer);
    }

    removeFile(uri: vscode.Uri): void {
        const filePath = uri.fsPath;
        this.logger.info(`Removing file from cache: ${filePath}`);
        this.cache.removeByFile(filePath);

        if (this.debounceTimers.has(filePath)) {
            clearTimeout(this.debounceTimers.get(filePath)!);
            this.debounceTimers.delete(filePath);
        }
    }

    private showProgress(message: string, current: number, total: number, hide: boolean = false): void {
        if (hide) {
            this.statusBarItem.text = message;
            this.statusBarItem.show();
        } else {
            const progress = total > 0 ? `${current}/${total}` : '';
            this.statusBarItem.text = getLabels().statusBarProgress.replace('{0}', message).replace('{1}', progress);
            this.statusBarItem.show();
        }
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
            this.cache.clear();
            this.scanStateManager.clearAll();
        }

        return this.scanWorkspace();
    }

    dispose(): void {
        this.statusBarItem.dispose();

        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}
