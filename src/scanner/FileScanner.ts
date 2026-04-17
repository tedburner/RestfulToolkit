import * as vscode from 'vscode';
import { AnnotationParser } from '../parsers/AnnotationParser';
import { EndpointCache } from '../cache/EndpointCache';
import { Logger } from '../utils/Logger';

export class FileScanner {
    private annotationParser: AnnotationParser;
    private cache: EndpointCache;
    private logger: Logger;
    private statusBarItem: vscode.StatusBarItem;
    private scanPromise: Promise<void> | null = null;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(cache: EndpointCache) {
        this.annotationParser = new AnnotationParser();
        this.cache = cache;
        this.logger = Logger.getInstance();
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
        const scanPatterns = vscode.workspace
            .getConfiguration('restfulToolkit')
            .get<string[]>('scanPaths', [
                'src/main/java/**/*.java',
                'src/main/kotlin/**/*.kt'
            ]);

        const excludePatterns = vscode.workspace
            .getConfiguration('restfulToolkit')
            .get<string[]>('excludePaths', [
                'src/test/**',
                '**/target/**',
                '**/build/**'
            ]);

        this.logger.info(`Starting workspace scan with patterns: ${scanPatterns.join(', ')}`);
        this.showProgress('正在扫描项目...', 0, 0);

        let totalFiles = 0;
        let scannedFiles = 0;

        for (const pattern of scanPatterns) {
            const files = await vscode.workspace.findFiles(pattern, `{${excludePatterns.join(',')}}`);
            totalFiles += files.length;
        }

        if (totalFiles === 0) {
            this.logger.info('No files found to scan');
            this.showProgress('扫描完成，未找到文件', 0, 0, true);
            return;
        }

        for (const pattern of scanPatterns) {
            const files = await vscode.workspace.findFiles(pattern, `{${excludePatterns.join(',')}}`);

            for (const file of files) {
                await this.scanFile(file);
                scannedFiles++;
                this.showProgress('正在扫描项目...', scannedFiles, totalFiles);
            }
        }

        const endpointCount = this.cache.size();
        this.logger.info(`Scan complete. Found ${endpointCount} endpoints`);
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
            }

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to scan file: ${uri.fsPath}`, err);
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