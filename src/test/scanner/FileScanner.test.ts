import * as assert from 'assert';
import * as vscode from 'vscode';
import { EndpointCache } from '../../cache/EndpointCache';
import { ScanStateManager } from '../../cache/ScanStateManager';
import { ConfigManager } from '../../config/ConfigManager';
import { FileScanner, FileScanResult } from '../../scanner/FileScanner';

suite('FileScanner Test Suite', () => {
    const originalFindFiles = vscode.workspace.findFiles;
    const originalCreateStatusBarItem = vscode.window.createStatusBarItem;
    const originalLanguage = vscode.env.language;
    const originalReadFile = vscode.workspace.fs.readFile;
    const originalStat = vscode.workspace.fs.stat;
    type ScannerInternals = {
        performScan(forceFullScan: boolean): Promise<void>;
        scanFile(uri: vscode.Uri): Promise<FileScanResult>;
        scanFileAndRecord(uri: vscode.Uri): Promise<FileScanResult>;
        parseFile(uri: vscode.Uri): Promise<FileScanResult & { endpoints: unknown[] }>;
        scanFileDebounced(uri: vscode.Uri, delay?: number): void;
        removeFile(uri: vscode.Uri): void;
        annotationParser: { parseFile(content: string, filePath: string): unknown[] };
        dispose(): void;
    };

    teardown(() => {
        vscode.workspace.findFiles = originalFindFiles;
        vscode.window.createStatusBarItem = originalCreateStatusBarItem;
        vscode.workspace.fs.readFile = originalReadFile;
        vscode.workspace.fs.stat = originalStat;
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

        let findFilesCalls = 0;
        vscode.workspace.findFiles = async (include: vscode.GlobPattern) => {
            findFilesCalls++;
            const pattern = String(include);
            if (pattern === '{**/src/main/java/**/*.java,**/*.java}') {
                return files;
            }
            return [];
        };
        vscode.workspace.fs.stat = async () => ({
            type: vscode.FileType.File,
            ctime: 0,
            mtime: 100,
            size: 10
        });

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

        const scanner = new FileScanner(new EndpointCache()) as unknown as ScannerInternals;
        const scannedFiles: string[] = [];
        scanner.parseFile = async (uri: vscode.Uri) => {
            scannedFiles.push(uri.fsPath);
            return { success: true, endpointCount: 0, endpoints: [] };
        };

        try {
            await scanner.performScan(false);
        } finally {
            scanner.dispose();
            configManager.getScanConfig = originalGetScanConfig;
            scanStateManager.needsScan = originalNeedsScan;
            scanStateManager.recordScan = originalRecordScan;
        }

        assert.strictEqual(needsScanCalls, files.length);
        assert.strictEqual(findFilesCalls, 1);
        assert.strictEqual(scannedFiles.length, files.length);
        assert.strictEqual(new Set(scannedFiles).size, files.length);
        assert.ok(maxActiveNeedsScan <= 15, `expected at most 15 concurrent needsScan calls, got ${maxActiveNeedsScan}`);
    });

    test('replaces stale endpoints with an empty result without invoking the parser', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);

        const cache = new EndpointCache();
        const filePath = 'C:\\workspace\\PlainService.java';
        cache.add({
            method: 'GET', path: '/stale', className: 'PlainService', methodName: 'stale',
            file: filePath, line: 1, framework: 'Spring'
        });

        const originalReadFile = vscode.workspace.fs.readFile;
        vscode.workspace.fs.readFile = async () => Buffer.from('public class PlainService {}');
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        scanner.annotationParser = {
            parseFile: () => { throw new Error('prefilter should skip the full parser'); }
        };

        try {
            const result = await scanner.scanFile({ fsPath: filePath } as vscode.Uri);
            assert.deepStrictEqual(result, { success: true, endpointCount: 0 });
            assert.deepStrictEqual(cache.getByFile(filePath), []);
        } finally {
            vscode.workspace.fs.readFile = originalReadFile;
            scanner.dispose();
        }
    });

    test('prefilter allows fully qualified supported annotations in Kotlin files', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);
        const cache = new EndpointCache();
        const filePath = 'C:\\workspace\\Api.kt';
        const originalReadFile = vscode.workspace.fs.readFile;
        vscode.workspace.fs.readFile = async () => Buffer.from(
            '@org.springframework.web.bind.annotation.GetMapping("/api")\nfun api() = "ok"'
        );
        let parserCalls = 0;
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        scanner.annotationParser = {
            parseFile: () => {
                parserCalls++;
                return [{ method: 'GET', path: '/api', className: 'Api', methodName: 'api', file: filePath, line: 1, framework: 'Spring' }];
            }
        };
        try {
            assert.deepStrictEqual(
                await scanner.scanFile({ fsPath: filePath } as vscode.Uri),
                { success: true, endpointCount: 1 }
            );
            assert.strictEqual(parserCalls, 1);
            assert.strictEqual(cache.getByFile(filePath).length, 1);
        } finally {
            vscode.workspace.fs.readFile = originalReadFile;
            scanner.dispose();
        }
    });

    test('does not commit endpoints or scan metadata when a file changes during parsing', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);
        const filePath = 'C:\\workspace\\ChangingController.java';
        const file = { fsPath: filePath } as vscode.Uri;
        let readCompleted = false;
        vscode.workspace.fs.readFile = async () => {
            readCompleted = true;
            return Buffer.from(`
                public class ChangingController {
                    @GetMapping("/old")
                    public String oldValue() { return "old"; }
                }
            `);
        };
        vscode.workspace.fs.stat = async () => ({
            type: vscode.FileType.File,
            ctime: 0,
            mtime: readCompleted ? 200 : 100,
            size: readCompleted ? 20 : 10
        });

        const cache = new EndpointCache();
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        try {
            const result = await scanner.scanFileAndRecord(file);
            const scanDecision = await ScanStateManager.getInstance().needsScan(filePath);

            assert.strictEqual(result.success, false);
            assert.deepStrictEqual(cache.getByFile(filePath), []);
            assert.strictEqual(scanDecision.needsScan, true);
        } finally {
            scanner.dispose();
        }
    });

    test('records the endpoint count returned by each concurrent file scan', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);
        const files = [
            { fsPath: 'C:\\workspace\\One.java' } as vscode.Uri,
            { fsPath: 'C:\\workspace\\Two.java' } as vscode.Uri
        ];
        vscode.workspace.findFiles = async () => files;
        vscode.workspace.fs.stat = async () => ({
            type: vscode.FileType.File,
            ctime: 0,
            mtime: 100,
            size: 10
        });

        const configManager = ConfigManager.getInstance();
        const originalGetScanConfig = configManager.getScanConfig.bind(configManager);
        configManager.getScanConfig = () => ({ scanPaths: ['**/*.java'], excludePaths: [], maxResults: 100 });
        const state = ScanStateManager.getInstance();
        const originalRecordScan = state.recordScan.bind(state);
        const recorded = new Map<string, number>();
        state.recordScan = async (filePath, endpointCount) => { recorded.set(filePath, endpointCount); };

        const scanner = new FileScanner(new EndpointCache()) as unknown as ScannerInternals;
        scanner.parseFile = async (uri) => ({
            success: true,
            endpointCount: uri.fsPath.endsWith('One.java') ? 1 : 2,
            endpoints: []
        });
        try {
            await scanner.performScan(true);
            assert.strictEqual(recorded.get(files[0].fsPath), 1);
            assert.strictEqual(recorded.get(files[1].fsPath), 2);
        } finally {
            scanner.dispose();
            configManager.getScanConfig = originalGetScanConfig;
            state.recordScan = originalRecordScan;
        }
    });

    test('queues a full refresh after an active scan and clears stale results immediately before it', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);

        const cache = new EndpointCache();
        const scanner = new FileScanner(cache);
        const internals = scanner as unknown as ScannerInternals;
        let scanCalls = 0;
        let notifyFirstStarted!: () => void;
        const firstStarted = new Promise<void>(resolve => { notifyFirstStarted = resolve; });
        let releaseFirst!: () => void;
        const firstCanFinish = new Promise<void>(resolve => { releaseFirst = resolve; });

        internals.performScan = async () => {
            scanCalls++;
            if (scanCalls === 1) {
                notifyFirstStarted();
                await firstCanFinish;
                cache.add({
                    method: 'GET', path: '/old', className: 'OldController', methodName: 'old',
                    file: 'C:\\workspace\\old\\OldController.java', line: 1, framework: 'Spring'
                });
                return;
            }
            assert.strictEqual(cache.size(), 0, 'queued full refresh must clear results after the old scan finishes');
        };

        try {
            const initialScan = scanner.scanWorkspace();
            await firstStarted;
            const refresh = scanner.refresh(true);
            releaseFirst();
            await Promise.all([initialScan, refresh]);

            assert.strictEqual(scanCalls, 2, 'a forced refresh during a scan must schedule another full scan');
            assert.strictEqual(cache.size(), 0);
        } finally {
            scanner.dispose();
        }
    });

    test('does not record a successful scan when reading the file fails', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);
        const file = { fsPath: 'C:\\workspace\\UnreadableController.java' } as vscode.Uri;
        vscode.workspace.findFiles = async () => [file];

        const configManager = ConfigManager.getInstance();
        const originalGetScanConfig = configManager.getScanConfig.bind(configManager);
        configManager.getScanConfig = () => ({ scanPaths: ['**/*.java'], excludePaths: [], maxResults: 100 });
        const originalReadFile = vscode.workspace.fs.readFile;
        vscode.workspace.fs.stat = async () => ({
            type: vscode.FileType.File,
            ctime: 0,
            mtime: 100,
            size: 10
        });
        vscode.workspace.fs.readFile = async () => { throw new Error('temporary read failure'); };

        const state = ScanStateManager.getInstance();
        const originalRecordScan = state.recordScan.bind(state);
        let recordCalls = 0;
        state.recordScan = async () => { recordCalls++; };

        const scanner = new FileScanner(new EndpointCache());
        try {
            await (scanner as unknown as ScannerInternals).performScan(true);
            assert.strictEqual(recordCalls, 0, 'failed files must remain eligible for a later incremental retry');
        } finally {
            scanner.dispose();
            configManager.getScanConfig = originalGetScanConfig;
            vscode.workspace.fs.readFile = originalReadFile;
            state.recordScan = originalRecordScan;
        }
    });

    test('continues with a queued full refresh when the active scan fails', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);

        const scanner = new FileScanner(new EndpointCache());
        const internals = scanner as unknown as ScannerInternals;
        let scanCalls = 0;
        let notifyFirstStarted!: () => void;
        const firstStarted = new Promise<void>(resolve => { notifyFirstStarted = resolve; });
        let releaseFailure!: () => void;
        const firstCanFail = new Promise<void>(resolve => { releaseFailure = resolve; });

        internals.performScan = async () => {
            scanCalls++;
            if (scanCalls === 1) {
                notifyFirstStarted();
                await firstCanFail;
                throw new Error('first scan failed');
            }
        };

        try {
            const initialScan = scanner.scanWorkspace();
            await firstStarted;
            const refresh = scanner.refresh(true);
            releaseFailure();

            await Promise.all([initialScan, refresh]);
            assert.strictEqual(scanCalls, 2, 'queued full refresh must run after the failed scan');
        } finally {
            releaseFailure();
            scanner.dispose();
        }
    });

    test('removing a file cancels its pending debounced scan', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);

        const file = { fsPath: 'C:\\workspace\\RemovedController.java' } as vscode.Uri;
        const cache = new EndpointCache();
        cache.add({
            method: 'GET', path: '/removed', className: 'RemovedController', methodName: 'getRemoved',
            file: file.fsPath, line: 1, framework: 'Spring'
        });
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        let scanCalls = 0;
        scanner.scanFile = async () => {
            scanCalls++;
            return { success: true, endpointCount: 0 };
        };

        try {
            scanner.scanFileDebounced(file, 5);
            scanner.removeFile(file);
            await new Promise(resolve => setTimeout(resolve, 20));

            assert.strictEqual(scanCalls, 0);
            assert.strictEqual(cache.size(), 0);
        } finally {
            scanner.dispose();
        }
    });

    test('records scan state after a successful debounced file scan', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);
        const file = { fsPath: 'C:\\workspace\\WatchedController.java' } as vscode.Uri;
        vscode.workspace.fs.readFile = async () => Buffer.from(`
            public class WatchedController {
                @GetMapping("/watched")
                public String watched() { return "ok"; }
            }
        `);
        vscode.workspace.fs.stat = async () => ({
            type: vscode.FileType.File,
            ctime: 0,
            mtime: 123,
            size: 456
        });

        const scanner = new FileScanner(new EndpointCache());
        try {
            scanner.scanFileDebounced(file, 0);
            await new Promise(resolve => setTimeout(resolve, 20));

            assert.deepStrictEqual(ScanStateManager.getInstance().getStats(), {
                totalFiles: 1,
                totalEndpoints: 1,
                lastScanTime: ScanStateManager.getInstance().getStats().lastScanTime
            });
            assert.ok(ScanStateManager.getInstance().getStats().lastScanTime);
        } finally {
            scanner.dispose();
        }
    });

    test('removing a file also removes its scan record', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);
        const file = { fsPath: 'C:\\workspace\\RemovedController.java' } as vscode.Uri;
        const state = ScanStateManager.getInstance();
        await state.recordScan(file.fsPath, 2, 100, 10);
        const scanner = new FileScanner(new EndpointCache());

        try {
            scanner.removeFile(file);
            assert.strictEqual(state.getStats().totalFiles, 0);
            assert.strictEqual(state.getStats().totalEndpoints, 0);
        } finally {
            scanner.dispose();
        }
    });

    test('cancels the previous status hide timer before a new scan starts', async () => {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);
        const file = { fsPath: 'C:\\workspace\\Controller.java' } as vscode.Uri;
        vscode.workspace.findFiles = async () => [file];

        const configManager = ConfigManager.getInstance();
        const originalGetScanConfig = configManager.getScanConfig.bind(configManager);
        configManager.getScanConfig = () => ({ scanPaths: ['**/*.java'], excludePaths: [], maxResults: 100 });
        const state = ScanStateManager.getInstance();
        const originalRecordScan = state.recordScan.bind(state);
        state.recordScan = async () => undefined;

        const originalSetTimeout = global.setTimeout;
        const originalClearTimeout = global.clearTimeout;
        let nextTimerId = 1;
        const clearedTimerIds: number[] = [];
        global.setTimeout = ((callback: (...args: unknown[]) => void) => {
            void callback;
            return nextTimerId++ as unknown as NodeJS.Timeout;
        }) as typeof setTimeout;
        global.clearTimeout = ((timer: NodeJS.Timeout) => {
            clearedTimerIds.push(timer as unknown as number);
        }) as typeof clearTimeout;

        const scanner = new FileScanner(new EndpointCache()) as unknown as ScannerInternals;
        scanner.parseFile = async () => ({ success: true, endpointCount: 0, endpoints: [] });
        try {
            await scanner.performScan(true);
            await scanner.performScan(true);
            assert.ok(clearedTimerIds.includes(1), 'the next scan must cancel the previous hide timer');
        } finally {
            scanner.dispose();
            configManager.getScanConfig = originalGetScanConfig;
            state.recordScan = originalRecordScan;
            global.setTimeout = originalSetTimeout;
            global.clearTimeout = originalClearTimeout;
        }
    });
});
