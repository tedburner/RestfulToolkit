import * as assert from 'assert';
import * as vscode from 'vscode';
import { EndpointCache } from '../../cache/EndpointCache';
import { ScanStateManager } from '../../cache/ScanStateManager';
import { ConfigManager } from '../../config/ConfigManager';
import { FileScanner } from '../../scanner/FileScanner';

suite('FileScanner Test Suite', () => {
    const originalFindFiles = vscode.workspace.findFiles;
    const originalCreateStatusBarItem = vscode.window.createStatusBarItem;
    const originalLanguage = vscode.env.language;
    type ScannerInternals = {
        performScan(forceFullScan: boolean): Promise<void>;
        scanFile(uri: vscode.Uri): Promise<void>;
        dispose(): void;
    };

    teardown(() => {
        vscode.workspace.findFiles = originalFindFiles;
        vscode.window.createStatusBarItem = originalCreateStatusBarItem;
        (vscode.env as typeof vscode.env & { language: string }).language = originalLanguage;
        ScanStateManager.reset();
    });

    test('deduplicates scan candidates and limits needsScan concurrency', async () => {
        (vscode.env as typeof vscode.env & { language: string }).language = 'en';
        vscode.window.createStatusBarItem = () => ({
            text: '',
            show: () => undefined,
            hide: () => undefined,
            dispose: () => undefined
        } as vscode.StatusBarItem);

        const files = Array.from({ length: 20 }, (_, index) =>
            ({ fsPath: `C:\\workspace\\module\\src\\main\\java\\Controller${index}.java` } as vscode.Uri)
        );

        vscode.workspace.findFiles = async (include: vscode.GlobPattern) => {
            const pattern = String(include);
            if (pattern === '**/src/main/java/**/*.java') {
                return files;
            }
            return [files[0], files[1], files[2]];
        };

        const configManager = ConfigManager.getInstance();
        const originalGetScanConfig = configManager.getScanConfig.bind(configManager);
        configManager.getScanConfig = () => ({
            scanPaths: [
                '**/src/main/java/**/*.java',
                '**/*.java'
            ],
            excludePaths: [],
            maxResults: 100
        });

        const scanStateManager = ScanStateManager.getInstance();
        const originalNeedsScan = scanStateManager.needsScan.bind(scanStateManager);
        const originalRecordScan = scanStateManager.recordScan.bind(scanStateManager);
        const originalSaveState = scanStateManager.saveState.bind(scanStateManager);
        let activeNeedsScan = 0;
        let maxActiveNeedsScan = 0;
        let needsScanCalls = 0;
        scanStateManager.needsScan = async (filePath: string) => {
            needsScanCalls++;
            activeNeedsScan++;
            maxActiveNeedsScan = Math.max(maxActiveNeedsScan, activeNeedsScan);
            await new Promise(resolve => setTimeout(resolve, 5));
            activeNeedsScan--;
            return { needsScan: true, mtime: filePath.length };
        };
        scanStateManager.recordScan = async () => undefined;
        scanStateManager.saveState = () => undefined;

        const scanner = new FileScanner(new EndpointCache()) as unknown as ScannerInternals;
        const scannedFiles: string[] = [];
        scanner.scanFile = async (uri: vscode.Uri) => {
            scannedFiles.push(uri.fsPath);
        };

        try {
            await scanner.performScan(false);
        } finally {
            scanner.dispose();
            configManager.getScanConfig = originalGetScanConfig;
            scanStateManager.needsScan = originalNeedsScan;
            scanStateManager.recordScan = originalRecordScan;
            scanStateManager.saveState = originalSaveState;
        }

        assert.strictEqual(needsScanCalls, files.length);
        assert.strictEqual(scannedFiles.length, files.length);
        assert.strictEqual(new Set(scannedFiles).size, files.length);
        assert.ok(maxActiveNeedsScan <= 15, `expected at most 15 concurrent needsScan calls, got ${maxActiveNeedsScan}`);
    });
});
