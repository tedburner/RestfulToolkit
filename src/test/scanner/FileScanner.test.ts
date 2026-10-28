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
        scanFileAndRecord(uri: vscode.Uri): Promise<FileScanResult>;
        parseFile(uri: vscode.Uri): Promise<FileScanResult & { endpoints: unknown[] }>;
        scanFileDebounced(uri: vscode.Uri, delay?: number): void;
        removeFile(uri: vscode.Uri): void;
        annotationParser: { parseFileResult(content: string, filePath: string): { success: boolean; endpoints: unknown[] } };
        dispose(): void;
    };

    /** stubScanEnvironment 登记的还原动作；teardown 统一回滚，避免每个测试重复 finally 清理 */
    const restoreStack: Array<() => void> = [];

    teardown(() => {
        while (restoreStack.length > 0) {
            restoreStack.pop()!();
        }
        vscode.workspace.findFiles = originalFindFiles;
        vscode.window.createStatusBarItem = originalCreateStatusBarItem;
        vscode.workspace.fs.readFile = originalReadFile;
        vscode.workspace.fs.stat = originalStat;
        (vscode.env as typeof vscode.env & { language: string }).language = originalLanguage;
        ScanStateManager.reset();
    });

    function stubStatusBar(): void {
        vscode.window.createStatusBarItem = () => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        } as vscode.StatusBarItem);
    }

    /**
     * 一次性布置扫描环境：候选文件、文件内容、文件元数据与扫描配置。
     * readFile 与 getScanConfig 属于跨测试的全局单例状态，其还原动作登记到
     * restoreStack，由 teardown 统一执行；findFiles/stat/statusBar 由 teardown 直接还原。
     */
    function stubScanEnvironment(options: {
        /** findFiles 返回的候选文件；缺省时保留真实实现 */
        files?: vscode.Uri[];
        /** readFile 返回的内容；传函数可动态生成或抛出异常 */
        contents?: string | ((uri: vscode.Uri) => Buffer | Promise<Buffer>);
        /** stat 返回的元数据；缺省为固定值 mtime=100 size=10 */
        stat?: () => { ctime: number; mtime: number; size: number };
        /** stub getScanConfig 使用的 include 模式；不传则保留真实实现 */
        scanPaths?: string[];
    } = {}): void {
        if (options.files) {
            vscode.workspace.findFiles = async () => options.files!;
        }
        const stat = options.stat;
        vscode.workspace.fs.stat = stat
            ? async () => ({ type: vscode.FileType.File, ...stat() })
            : async () => ({ type: vscode.FileType.File, ctime: 0, mtime: 100, size: 10 });
        if (options.contents !== undefined) {
            const contents = options.contents;
            vscode.workspace.fs.readFile = async (uri) =>
                Promise.resolve(typeof contents === 'function' ? contents(uri) : Buffer.from(contents));
            restoreStack.push(() => { vscode.workspace.fs.readFile = originalReadFile; });
        }
        if (options.scanPaths) {
            const configManager = ConfigManager.getInstance();
            const originalGetScanConfig = configManager.getScanConfig.bind(configManager);
            configManager.getScanConfig = () => ({
                scanPaths: options.scanPaths!,
                excludePaths: [],
                maxResults: 100
            });
            restoreStack.push(() => { configManager.getScanConfig = originalGetScanConfig; });
        }
    }

    test('deduplicates scan candidates and limits needsScan concurrency', async () => {
        (vscode.env as typeof vscode.env & { language: string }).language = 'en';
        stubStatusBar();

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
        stubScanEnvironment({ scanPaths: ['**/src/main/java/**/*.java', '**/*.java'] });

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
        stubStatusBar();
        const cache = new EndpointCache();
        const filePath = 'C:\\workspace\\PlainService.java';
        cache.add({
            method: 'GET', path: '/stale', className: 'PlainService', methodName: 'stale',
            file: filePath, line: 1, framework: 'Spring'
        });

        stubScanEnvironment({
            files: [{ fsPath: filePath } as vscode.Uri],
            contents: 'public class PlainService {}',
            scanPaths: ['**/*.java']
        });
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        scanner.annotationParser = {
            parseFileResult: () => { throw new Error('prefilter should skip the full parser'); }
        };

        try {
            await scanner.performScan(true);
            assert.deepStrictEqual(cache.getByFile(filePath), []);
        } finally {
            scanner.dispose();
        }
    });

    test('prefilter allows fully qualified supported annotations in Kotlin files', async () => {
        stubStatusBar();
        const cache = new EndpointCache();
        const filePath = 'C:\\workspace\\Api.kt';
        stubScanEnvironment({
            files: [{ fsPath: filePath } as vscode.Uri],
            contents: '@org.springframework.web.bind.annotation.GetMapping("/api")\nfun api() = "ok"',
            scanPaths: ['**/*.java']
        });
        let parserCalls = 0;
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        scanner.annotationParser = {
            parseFileResult: () => {
                parserCalls++;
                return { success: true, endpoints: [{ method: 'GET', path: '/api', className: 'Api', methodName: 'api', file: filePath, line: 1, framework: 'Spring' }] };
            }
        };
        try {
            await scanner.performScan(true);
            assert.strictEqual(parserCalls, 1);
            assert.strictEqual(cache.getByFile(filePath).length, 1);
        } finally {
            scanner.dispose();
        }
    });

    test('preserves cached endpoints when the parser reports failure', async () => {
        stubStatusBar();
        const filePath = 'C:\\workspace\\BrokenController.java';
        const cache = new EndpointCache();
        const previous = {
            method: 'GET' as const, path: '/last-known-good', className: 'BrokenController', methodName: 'list',
            file: filePath, line: 2, framework: 'Spring' as const
        };
        cache.add(previous);
        stubScanEnvironment({
            files: [{ fsPath: filePath } as vscode.Uri],
            contents: '@GetMapping("/new")\nclass BrokenController {}',
            scanPaths: ['**/*.java']
        });
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        scanner.annotationParser = { parseFileResult: () => ({ success: false, endpoints: [] }) };
        try {
            await scanner.performScan(true);
            assert.deepStrictEqual(cache.getByFile(filePath), [previous]);
        } finally {
            scanner.dispose();
        }
    });

    test('does not commit endpoints or scan metadata when a file changes during parsing', async () => {
        stubStatusBar();
        const filePath = 'C:\\workspace\\ChangingController.java';
        const file = { fsPath: filePath } as vscode.Uri;
        let readCompleted = false;
        stubScanEnvironment({
            contents: async () => {
                readCompleted = true;
                return Buffer.from(`
                    public class ChangingController {
                        @GetMapping("/old")
                        public String oldValue() { return "old"; }
                    }
                `);
            },
            stat: () => ({
                ctime: 0,
                mtime: readCompleted ? 200 : 100,
                size: readCompleted ? 20 : 10
            })
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
        stubStatusBar();
        const files = [
            { fsPath: 'C:\\workspace\\One.java' } as vscode.Uri,
            { fsPath: 'C:\\workspace\\Two.java' } as vscode.Uri
        ];
        stubScanEnvironment({ files, scanPaths: ['**/*.java'] });

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
            state.recordScan = originalRecordScan;
        }
    });

    test('queues a full refresh after an active scan while retaining the previous snapshot', async () => {
        stubStatusBar();

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
            assert.strictEqual(cache.size(), 1, 'previous snapshot remains available until discovery succeeds');
        };

        try {
            const initialScan = scanner.scanWorkspace();
            await firstStarted;
            const refresh = scanner.refresh(true);
            releaseFirst();
            await Promise.all([initialScan, refresh]);

            assert.strictEqual(scanCalls, 2, 'a forced refresh during a scan must schedule another full scan');
            assert.strictEqual(cache.size(), 1);
        } finally {
            scanner.dispose();
        }
    });

    test('does not record a successful scan when reading the file fails', async () => {
        stubStatusBar();
        const file = { fsPath: 'C:\\workspace\\UnreadableController.java' } as vscode.Uri;
        stubScanEnvironment({
            files: [file],
            contents: () => { throw new Error('temporary read failure'); },
            scanPaths: ['**/*.java']
        });

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
            state.recordScan = originalRecordScan;
        }
    });

    test('continues with a queued full refresh when the active scan fails', async () => {
        stubStatusBar();

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
        stubStatusBar();
        const file = { fsPath: 'C:\\workspace\\RemovedController.java' } as vscode.Uri;
        const cache = new EndpointCache();
        cache.add({
            method: 'GET', path: '/removed', className: 'RemovedController', methodName: 'getRemoved',
            file: file.fsPath, line: 1, framework: 'Spring'
        });
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        stubScanEnvironment({ contents: '@GetMapping("/removed")\nclass RemovedController {}' });
        let parserCalls = 0;
        scanner.annotationParser = {
            parseFileResult: () => {
                parserCalls++;
                return { success: true, endpoints: [] };
            }
        };

        try {
            scanner.scanFileDebounced(file, 5);
            scanner.removeFile(file);
            await new Promise(resolve => setTimeout(resolve, 20));

            assert.strictEqual(parserCalls, 0, 'the debounced scan must not run after removal');
            assert.strictEqual(cache.size(), 0);
        } finally {
            scanner.dispose();
        }
    });

    test('records scan state after a successful debounced file scan', async () => {
        stubStatusBar();
        const file = { fsPath: 'C:\\workspace\\WatchedController.java' } as vscode.Uri;
        stubScanEnvironment({
            contents: `
                public class WatchedController {
                    @GetMapping("/watched")
                    public String watched() { return "ok"; }
                }
            `,
            stat: () => ({ ctime: 0, mtime: 123, size: 456 })
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
        stubStatusBar();
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

    test('does not revive removed endpoints when deletion races an in-flight scan', async () => {
        stubStatusBar();
        const file = { fsPath: 'C:\\workspace\\RaceController.java' } as vscode.Uri;
        let releaseRead!: () => void;
        const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
        stubScanEnvironment({
            contents: async () => {
                await readGate;
                return Buffer.from('@GetMapping("/race")\nclass RaceController {}');
            }
        });

        const cache = new EndpointCache();
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        const scanPromise = scanner.scanFileAndRecord(file);
        await new Promise(resolve => setTimeout(resolve, 5));

        scanner.removeFile(file);
        releaseRead();
        const result = await scanPromise;

        assert.strictEqual(result.success, false, 'a result committed after removal must be dropped');
        assert.strictEqual(cache.size(), 0);
        assert.strictEqual(ScanStateManager.getInstance().getStats().totalFiles, 0);
        scanner.dispose();
    });

    test('reconciles indexed files that disappeared from the discovery result', async () => {
        stubStatusBar();
        const filePath = 'C:\\workspace\\GoneController.java';
        const cache = new EndpointCache();
        cache.add({
            method: 'GET', path: '/gone', className: 'GoneController', methodName: 'gone',
            file: filePath, line: 1, framework: 'Spring'
        });
        const state = ScanStateManager.getInstance();
        await state.recordScan(filePath, 1, 100, 10);

        stubScanEnvironment({ files: [], scanPaths: ['**/*.java'] });

        const scanner = new FileScanner(cache);
        try {
            await (scanner as unknown as ScannerInternals).performScan(false);
            assert.strictEqual(cache.size(), 0, 'files missing from discovery must be reconciled away');
            assert.strictEqual(state.getStats().totalFiles, 0);
        } finally {
            scanner.dispose();
        }
    });

    test('reconciles cached endpoints even after a failed scan removes their state record', async () => {
        stubStatusBar();
        const file = vscode.Uri.file('/workspace/Gone.java');
        const cache = new EndpointCache();
        cache.add({ method: 'GET', path: '/gone', className: 'Gone', methodName: 'gone', file: file.fsPath, line: 1, framework: 'Spring' });
        const state = ScanStateManager.getInstance();
        await state.recordScan(file.fsPath, 1, 100, 10);
        stubScanEnvironment({ files: [], scanPaths: ['**/*.java'] });
        vscode.workspace.fs.stat = async () => { throw new Error('temporarily inaccessible'); };
        const scanner = new FileScanner(cache);
        try {
            await (scanner as unknown as ScannerInternals).scanFileAndRecord(file);
            assert.strictEqual(cache.size(), 1);
            assert.strictEqual(state.getAllScannedFiles().length, 0);
            await (scanner as unknown as ScannerInternals).performScan(false);
            assert.strictEqual(cache.size(), 0);
        } finally { scanner.dispose(); }
    });

    test('failed forced parse preserves cached endpoints and makes unchanged files eligible for retry', async () => {
        stubStatusBar();
        const file = vscode.Uri.file('/workspace/Retry.java');
        const cache = new EndpointCache();
        cache.add({ method: 'GET', path: '/retry', className: 'Retry', methodName: 'get', file: file.fsPath, line: 1, framework: 'Spring' });
        const state = ScanStateManager.getInstance();
        await state.recordScan(file.fsPath, 1, 100, 10);
        stubScanEnvironment({ files: [file], contents: () => { throw new Error('read failure'); }, scanPaths: ['**/*.java'] });
        const scanner = new FileScanner(cache);
        try {
            await scanner.refresh(true);
            assert.strictEqual(cache.size(), 1);
            assert.strictEqual((await state.needsScan(file.fsPath)).needsScan, true);
        } finally { scanner.dispose(); }
    });

    test('reconciles only trusted roots in a multi-root workspace', async () => {
        stubStatusBar();
        const cache = new EndpointCache();
        const state = ScanStateManager.getInstance();
        const keep = vscode.Uri.file('/workspace/unknown/Keep.java');
        const remove = vscode.Uri.file('/workspace/known/Gone.java');
        for (const file of [keep, remove]) {
            cache.add({ method: 'GET', path: file.fsPath, className: 'Controller', methodName: 'get', file: file.fsPath, line: 1, framework: 'Spring' });
            await state.recordScan(file.fsPath, 1, 100, 10);
        }
        stubScanEnvironment({ files: [] });
        const config = ConfigManager.getInstance();
        const original = config.getFolderScanConfigs;
        config.getFolderScanConfigs = () => [
            { folder: vscode.Uri.file('/workspace/unknown'), scanPaths: [], excludePaths: [] },
            { folder: vscode.Uri.file('/workspace/known'), scanPaths: ['**/*.java'], excludePaths: [] }
        ];
        const scanner = new FileScanner(cache);
        try {
            await scanner.refresh(true);
            assert.strictEqual(cache.getByFile(keep.fsPath).length, 1);
            assert.strictEqual(cache.getByFile(remove.fsPath).length, 0);
        } finally { scanner.dispose(); config.getFolderScanConfigs = original; }
    });

    test('keeps indexed endpoints when scanPaths resolve to no include patterns', async () => {
        stubStatusBar();
        const filePath = 'C:\\workspace\\KeepController.java';
        const cache = new EndpointCache();
        cache.add({
            method: 'GET', path: '/keep', className: 'KeepController', methodName: 'keep',
            file: filePath, line: 1, framework: 'Spring'
        });
        const state = ScanStateManager.getInstance();
        await state.recordScan(filePath, 1, 100, 10);

        stubScanEnvironment({ files: [], scanPaths: [] });

        const scanner = new FileScanner(cache);
        try {
            await (scanner as unknown as ScannerInternals).performScan(false);
            assert.strictEqual(cache.size(), 1, 'empty include patterns mean discovery is unknown, not empty');
            assert.strictEqual(state.getStats().totalFiles, 1);
        } finally {
            scanner.dispose();
        }
    });

    test('waitForIdle waits for debounced watcher scans to finish', async () => {
        stubStatusBar();
        const file = { fsPath: 'C:\\workspace\\IdleController.java' } as vscode.Uri;
        stubScanEnvironment({
            contents: `
                public class IdleController {
                    @GetMapping("/idle")
                    public String idle() { return "ok"; }
                }
            `,
            stat: () => ({ ctime: 0, mtime: 123, size: 456 })
        });

        const scanner = new FileScanner(new EndpointCache());
        try {
            scanner.scanFileDebounced(file, 20);
            await scanner.waitForIdle();
            assert.strictEqual(
                ScanStateManager.getInstance().getStats().totalFiles, 1,
                'waitForIdle must wait until debounced events have entered the queue and finished'
            );
        } finally {
            scanner.dispose();
        }
    });

    test('waitForIdle waits for in-flight watcher queue scans to finish', async () => {
        stubStatusBar();
        const names = ['Alpha', 'Beta', 'Gamma'];
        const files = names.map(name => ({ fsPath: `C:\\workspace\\${name}Controller.java` } as vscode.Uri));
        stubScanEnvironment({
            contents: (uri) => {
                const name = names.find(candidate => uri.fsPath.includes(candidate)) ?? 'Alpha';
                return Buffer.from(`@GetMapping("/${name.toLowerCase()}")\nclass ${name}Controller {}`);
            },
            stat: () => ({ ctime: 0, mtime: 123, size: 456 })
        });

        const scanner = new FileScanner(new EndpointCache());
        try {
            for (const file of files) {
                scanner.scanFileDebounced(file, 0);
            }
            await scanner.waitForIdle();
            assert.strictEqual(
                ScanStateManager.getInstance().getStats().totalFiles, files.length,
                'waitForIdle must drain the watcher queue including tasks already in flight'
            );
        } finally {
            scanner.dispose();
        }
    });

    test('workspace refresh cannot be overwritten by an older in-flight watcher result', async () => {
        stubStatusBar();
        const file = { fsPath: 'C:\\workspace\\ConcurrentController.java' } as vscode.Uri;
        let releaseOldRead!: () => void;
        let signalOldRead!: () => void;
        const oldReadStarted = new Promise<void>(resolve => { signalOldRead = resolve; });
        const oldReadGate = new Promise<void>(resolve => { releaseOldRead = resolve; });
        let reads = 0;
        stubScanEnvironment({
            files: [file],
            scanPaths: ['**/*.java'],
            contents: async () => {
                reads++;
                if (reads === 1) {
                    signalOldRead();
                    await oldReadGate;
                    return Buffer.from('class ConcurrentController {\n@GetMapping("/old")\npublic String old() { return "old"; }\n}');
                }
                return Buffer.from('class ConcurrentController {\n@GetMapping("/new")\npublic String current() { return "new"; }\n}');
            }
        });
        const cache = new EndpointCache();
        const scanner = new FileScanner(cache);
        let refresh: Promise<void> | undefined;
        try {
            scanner.scanFileDebounced(file, 0);
            await oldReadStarted;
            refresh = scanner.refresh(true);
            // 旧实现会在旧 watcher 仍在读取时完成刷新；修复后短暂等待会超时。
            await Promise.race([refresh, new Promise(resolve => setTimeout(resolve, 50))]);
            releaseOldRead();
            await refresh;
            await scanner.waitForIdle();
            assert.deepStrictEqual(cache.getByFile(file.fsPath).map(endpoint => endpoint.path), ['/new']);
        } finally {
            releaseOldRead();
            await refresh?.catch(() => undefined);
            await scanner.waitForIdle().catch(() => undefined);
            scanner.dispose();
        }
    });

    test('drops a batch-committed scan result when the file is removed during the scan', async () => {
        stubStatusBar();
        const file = { fsPath: 'C:\\workspace\\VanishedController.java' } as vscode.Uri;
        let releaseRead!: () => void;
        const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
        stubScanEnvironment({
            files: [file],
            contents: async () => {
                await readGate;
                return Buffer.from('@GetMapping("/vanished")\nclass VanishedController {}');
            },
            scanPaths: ['**/*.java']
        });

        const cache = new EndpointCache();
        const scanner = new FileScanner(cache) as unknown as ScannerInternals;
        try {
            const scanPromise = scanner.performScan(true);
            await new Promise(resolve => setTimeout(resolve, 5));
            scanner.removeFile(file);
            releaseRead();
            await scanPromise;

            assert.strictEqual(cache.size(), 0, 'a stale result collected before removal must not be committed');
            assert.strictEqual(ScanStateManager.getInstance().getStats().totalFiles, 0);
        } finally {
            scanner.dispose();
        }
    });

    test('cancels the previous status hide timer before a new scan starts', async () => {
        stubStatusBar();
        const file = { fsPath: 'C:\\workspace\\Controller.java' } as vscode.Uri;
        stubScanEnvironment({ files: [file], scanPaths: ['**/*.java'] });

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
            state.recordScan = originalRecordScan;
            global.setTimeout = originalSetTimeout;
            global.clearTimeout = originalClearTimeout;
        }
    });
});
