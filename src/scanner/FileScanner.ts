import * as vscode from 'vscode';
import { AnnotationParser } from '../parsers/AnnotationParser';
import { EndpointCache } from '../cache/EndpointCache';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../config/ConfigManager';

export class FileScanner {
    private annotationParser: AnnotationParser;
    private cache: EndpointCache;
    private logger: Logger;
    private configManager: ConfigManager;
    private statusBarItem: vscode.StatusBarItem;
    private scanPromise: Promise<void> | null = null;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(cache: EndpointCache) {
        this.annotationParser = new AnnotationParser();
        this.cache = cache;
        this.logger = Logger.getInstance();
        this.configManager = ConfigManager.getInstance();
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    }

    async scanWorkspace(): Promise<void> {
        if (this.scanPromise) {
            this.logger.info('Scan already in progress, waiting for completion');
            await this.scanPromise;
            return;
        }

        this.scanPromise = this.performScan();
        try {
            await this.scanPromise;
        } finally {
            this.scanPromise = null;
        }
    }

    private async performScan(): Promise<void> {
        const config = this.configManager.getScanConfig();
        const scanPatterns = config.scanPaths;
        const excludePatterns = config.excludePaths;

        this.logger.info(`Starting workspace scan with patterns: ${scanPatterns.join(', ')}`);
        this.logger.info(`Exclude patterns: ${excludePatterns.join(', ')}`);
        this.logger.info(`Exclude pattern string: {${excludePatterns.join(',')}}`);

        // 诊断：检查工作区文件夹
        if (vscode.workspace.workspaceFolders) {
            this.logger.info(`Workspace folders: ${vscode.workspace.workspaceFolders.map(f => f.uri.fsPath).join(', ')}`);
        } else {
            this.logger.warning('No workspace folder found');
        }

        // 诊断：直接测试是否能找到 Controller 文件
        const controllerTest = await vscode.workspace.findFiles('**/controller/*.java', '{**/src/test/**,**/target/**}');
        this.logger.info(`Controller files test (pattern: **/controller/*.java): found ${controllerTest.length} files`);
        if (controllerTest.length > 0) {
            this.logger.info(`Controller files: ${controllerTest.slice(0, 5).map(f => f.fsPath).join(', ')}`);
        }

        this.showProgress('正在扫描项目...', 0, 0);

        let totalFiles = 0;
        let scannedFiles = 0;
        let filesWithEndpoints = 0;

        // 统计每个模式找到的文件数
        const patternFileCounts: Map<string, number> = new Map();

        for (const pattern of scanPatterns) {
            const files = await vscode.workspace.findFiles(pattern, `{${excludePatterns.join(',')}}`);
            patternFileCounts.set(pattern, files.length);
            totalFiles += files.length;
        }

        this.logger.info(`Files found per pattern: ${Array.from(patternFileCounts.entries()).map(([p, c]) => `${p}:${c}`).join(', ')}`);
        this.logger.info(`Total files to scan: ${totalFiles}`);

        if (totalFiles === 0) {
            this.logger.info('No files found to scan');
            this.logger.warning('Possible reasons: 1) No Java/Kotlin files in workspace 2) All files excluded 3) Workspace folder not set correctly');
            this.showProgress('扫描完成，未找到文件', 0, 0, true);
            return;
        }

        for (const pattern of scanPatterns) {
            const files = await vscode.workspace.findFiles(pattern, `{${excludePatterns.join(',')}}`);

            for (const file of files) {
                const filePath = file.fsPath;

                // 跳过异常文件（如 .git 后缀）
                if (filePath.endsWith('.git') || filePath.includes('.git')) {
                    this.logger.warning(`Skipping abnormal file: ${filePath}`);
                    continue;
                }

                const endpointCountBefore = this.cache.size();
                await this.scanFile(file);
                const endpointCountAfter = this.cache.size();

                const endpointsFound = endpointCountAfter - endpointCountBefore;
                if (endpointsFound > 0) {
                    filesWithEndpoints++;
                    this.logger.info(`Found ${endpointsFound} endpoints in: ${filePath}`);
                }

                scannedFiles++;
                this.showProgress('正在扫描项目...', scannedFiles, totalFiles);
            }
        }

        const endpointCount = this.cache.size();
        this.logger.info(`Scan complete. Scanned ${scannedFiles} files, ${filesWithEndpoints} files with endpoints, total ${endpointCount} endpoints`);
        this.showProgress(`扫描完成，共找到 ${endpointCount} 个 REST 端点`, totalFiles, totalFiles, true);

        setTimeout(() => {
            this.statusBarItem.hide();
        }, 3000);
    }

    async scanFile(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            const filePath = uri.fsPath;

            if (!filePath.endsWith('.java') && !filePath.endsWith('.kt')) {
                return;
            }

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

        const timer = setTimeout(async () => {
            this.debounceTimers.delete(filePath);
            await this.scanFile(uri);
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
            this.statusBarItem.text = `RestfulToolkit: ${message} (${progress} 文件)`;
            this.statusBarItem.show();
        }
    }

    refresh(): Promise<void> {
        this.logger.info('Manual refresh triggered');
        this.cache.clear();
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