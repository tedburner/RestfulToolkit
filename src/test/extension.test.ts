import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';
import { FileScanner } from '../scanner/FileScanner';
import { FileWatcher } from '../utils/FileWatcher';

suite('Extension Activation Test Suite', () => {
    test('runs a queued configuration reload after the active reload fails', async () => {
        const originalRegister = vscode.commands.registerCommand;
        const originalStatus = vscode.window.createStatusBarItem;
        const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
        const originalListener = vscode.workspace.onDidChangeConfiguration;
        const originalSetFolders = ConfigManager.prototype.setWorkspaceFolders;
        const originalStart = FileWatcher.prototype.start;
        const originalScan = FileScanner.prototype.scanWorkspace;
        let listener!: (event: vscode.ConfigurationChangeEvent) => void;
        let release!: () => void;
        let started!: () => void;
        const blocked = new Promise<void>(resolve => { release = resolve; });
        const entered = new Promise<void>(resolve => { started = resolve; });
        let calls = 0;
        vscode.commands.registerCommand = (() => ({ dispose: () => undefined })) as typeof vscode.commands.registerCommand;
        vscode.window.createStatusBarItem = (() => ({ text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined })) as typeof vscode.window.createStatusBarItem;
        vscode.workspace.createFileSystemWatcher = ((() => ({ onDidCreate: () => ({ dispose: () => undefined }), onDidChange: () => ({ dispose: () => undefined }), onDidDelete: () => ({ dispose: () => undefined }), dispose: () => undefined })) as unknown) as typeof vscode.workspace.createFileSystemWatcher;
        (vscode.workspace as unknown as { onDidChangeConfiguration: typeof vscode.workspace.onDidChangeConfiguration }).onDidChangeConfiguration = ((fn: typeof listener) => { listener = fn; return { dispose: () => undefined }; }) as typeof vscode.workspace.onDidChangeConfiguration;
        ConfigManager.prototype.setWorkspaceFolders = async () => {
            calls++;
            if (calls === 2) { started(); await blocked; throw new Error('reload failed'); }
        };
        FileWatcher.prototype.start = () => undefined;
        FileScanner.prototype.scanWorkspace = async () => undefined;
        const extension = await import('../extension');
        try {
            await extension.activate({ subscriptions: [] } as unknown as vscode.ExtensionContext);
            const event = { affectsConfiguration: () => true } as vscode.ConfigurationChangeEvent;
            listener(event);
            await entered;
            listener(event);
            release();
            await new Promise(resolve => setTimeout(resolve, 0));
            assert.strictEqual(calls, 3, 'queued reload must run after the failure');
            await extension.deactivate();
        } finally {
            release();
            vscode.commands.registerCommand = originalRegister;
            vscode.window.createStatusBarItem = originalStatus;
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
            (vscode.workspace as unknown as { onDidChangeConfiguration: typeof vscode.workspace.onDidChangeConfiguration }).onDidChangeConfiguration = originalListener;
            ConfigManager.prototype.setWorkspaceFolders = originalSetFolders;
            FileWatcher.prototype.start = originalStart;
            FileScanner.prototype.scanWorkspace = originalScan;
        }
    });
    test('registers commands before the initial scan completes', async () => {
        const originalRegisterCommand = vscode.commands.registerCommand;
        const originalStatusBar = vscode.window.createStatusBarItem;
        const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
        const originalSetFolders = ConfigManager.prototype.setWorkspaceFolders;
        const originalGetConfig = ConfigManager.prototype.getScanConfig;
        const originalWatcherStart = FileWatcher.prototype.start;
        const originalScan = FileScanner.prototype.scanWorkspace;

        const registered: string[] = [];
        const watcherPatterns: string[] = [];
        vscode.commands.registerCommand = ((command: string) => {
            registered.push(command);
            return { dispose: () => undefined };
        }) as typeof vscode.commands.registerCommand;
        vscode.window.createStatusBarItem = (() => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        })) as typeof vscode.window.createStatusBarItem;
        vscode.workspace.createFileSystemWatcher = (((pattern: vscode.GlobPattern) => {
            watcherPatterns.push(String(pattern));
            return ({
            onDidCreate: () => ({ dispose: () => undefined }),
            onDidChange: () => ({ dispose: () => undefined }),
            onDidDelete: () => ({ dispose: () => undefined }),
            dispose: () => undefined
            });
        }) as unknown) as typeof vscode.workspace.createFileSystemWatcher;
        ConfigManager.prototype.setWorkspaceFolders = async () => undefined;
        ConfigManager.prototype.getScanConfig = () => ({
            scanPaths: ['**/*.java'], excludePaths: [], maxResults: 100
        });
        FileWatcher.prototype.start = () => undefined;

        let finishScan!: () => void;
        FileScanner.prototype.scanWorkspace = () => new Promise<void>(resolve => { finishScan = resolve; });

        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        const extension = await import('../extension');
        const activation = extension.activate(context);
        try {
            await new Promise(resolve => setTimeout(resolve, 0));
            assert.ok(registered.includes('restfulToolkit.searchEndpoints'));
            assert.deepStrictEqual(watcherPatterns, [
                '**/main/resources/{application,application-*,bootstrap}.{yml,yaml,properties}',
                '**/.restful-toolkit.json'
            ]);
        } finally {
            finishScan();
            await activation;
            await extension.deactivate();
            vscode.commands.registerCommand = originalRegisterCommand;
            vscode.window.createStatusBarItem = originalStatusBar;
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
            ConfigManager.prototype.setWorkspaceFolders = originalSetFolders;
            ConfigManager.prototype.getScanConfig = originalGetConfig;
            FileWatcher.prototype.start = originalWatcherStart;
            FileScanner.prototype.scanWorkspace = originalScan;
        }
    });

    test('deactivation drains the background scan before disposing the scanner', async () => {
        const originalRegisterCommand = vscode.commands.registerCommand;
        const originalStatusBar = vscode.window.createStatusBarItem;
        const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
        const originalSetFolders = ConfigManager.prototype.setWorkspaceFolders;
        const originalGetConfig = ConfigManager.prototype.getScanConfig;
        const originalWatcherStart = FileWatcher.prototype.start;
        const originalScan = FileScanner.prototype.scanWorkspace;
        const originalDispose = FileScanner.prototype.dispose;

        vscode.commands.registerCommand = (() => ({ dispose: () => undefined })) as typeof vscode.commands.registerCommand;
        vscode.window.createStatusBarItem = (() => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        })) as typeof vscode.window.createStatusBarItem;
        vscode.workspace.createFileSystemWatcher = ((() => ({
            onDidCreate: () => ({ dispose: () => undefined }),
            onDidChange: () => ({ dispose: () => undefined }),
            onDidDelete: () => ({ dispose: () => undefined }),
            dispose: () => undefined
        })) as unknown) as typeof vscode.workspace.createFileSystemWatcher;
        ConfigManager.prototype.setWorkspaceFolders = async () => undefined;
        ConfigManager.prototype.getScanConfig = () => ({
            scanPaths: ['**/*.java'], excludePaths: [], maxResults: 100
        });
        FileWatcher.prototype.start = () => undefined;

        let finishScan!: () => void;
        FileScanner.prototype.scanWorkspace = () => new Promise<void>(resolve => { finishScan = resolve; });
        let scannerDisposeCalls = 0;
        FileScanner.prototype.dispose = function () {
            scannerDisposeCalls++;
            originalDispose.call(this);
        };

        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        const extension = await import('../extension');
        try {
            await extension.activate(context);
            let deactivated = false;
            const deactivation = extension.deactivate().then(() => { deactivated = true; });
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.strictEqual(scannerDisposeCalls, 0, 'deactivation must drain pending scans before disposing the scanner');
            assert.strictEqual(deactivated, false, 'deactivation must wait for the active background scan');

            finishScan();
            await deactivation;
            assert.strictEqual(deactivated, true);
            assert.strictEqual(scannerDisposeCalls, 1, 'deactivation must dispose the scanner once the scan settles');
        } finally {
            vscode.commands.registerCommand = originalRegisterCommand;
            vscode.window.createStatusBarItem = originalStatusBar;
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
            ConfigManager.prototype.setWorkspaceFolders = originalSetFolders;
            ConfigManager.prototype.getScanConfig = originalGetConfig;
            FileWatcher.prototype.start = originalWatcherStart;
            FileScanner.prototype.scanWorkspace = originalScan;
            FileScanner.prototype.dispose = originalDispose;
        }
    });

    test('deactivation waits for config reload and prevents watcher restart after shutdown', async () => {
        const originalRegisterCommand = vscode.commands.registerCommand;
        const originalStatusBar = vscode.window.createStatusBarItem;
        const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
        const originalOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration;
        const originalSetFolders = ConfigManager.prototype.setWorkspaceFolders;
        const originalGetConfig = ConfigManager.prototype.getScanConfig;
        const originalWatcherStart = FileWatcher.prototype.start;
        const originalScan = FileScanner.prototype.scanWorkspace;

        const watcherPatterns: string[] = [];
        vscode.commands.registerCommand = (() => ({ dispose: () => undefined })) as typeof vscode.commands.registerCommand;
        vscode.window.createStatusBarItem = (() => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        })) as typeof vscode.window.createStatusBarItem;
        vscode.workspace.createFileSystemWatcher = (((pattern: vscode.GlobPattern) => {
            watcherPatterns.push(String(pattern));
            return ({
            onDidCreate: () => ({ dispose: () => undefined }),
            onDidChange: () => ({ dispose: () => undefined }),
            onDidDelete: () => ({ dispose: () => undefined }),
            dispose: () => undefined
            });
        }) as unknown) as typeof vscode.workspace.createFileSystemWatcher;

        let configListener!: (event: vscode.ConfigurationChangeEvent) => Promise<void>;
        (vscode.workspace as unknown as { onDidChangeConfiguration: typeof vscode.workspace.onDidChangeConfiguration })
            .onDidChangeConfiguration = ((listener: (event: vscode.ConfigurationChangeEvent) => unknown) => {
            configListener = listener as (event: vscode.ConfigurationChangeEvent) => Promise<void>;
            return { dispose: () => undefined };
        }) as typeof vscode.workspace.onDidChangeConfiguration;

        let setFolderCalls = 0;
        let releaseReload!: () => void;
        const reloadCanFinish = new Promise<void>(resolve => { releaseReload = resolve; });
        ConfigManager.prototype.setWorkspaceFolders = async () => {
            setFolderCalls++;
            if (setFolderCalls > 1) {
                await reloadCanFinish;
            }
        };
        ConfigManager.prototype.getScanConfig = () => ({
            scanPaths: ['**/*.java'], excludePaths: [], maxResults: 100
        });
        let watcherStartCalls = 0;
        FileWatcher.prototype.start = () => { watcherStartCalls++; };
        FileScanner.prototype.scanWorkspace = async () => undefined;

        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        const extension = await import('../extension');
        let reload: Promise<void> | undefined;
        let deactivation: Promise<void> | undefined;
        try {
            await extension.activate(context);
            reload = configListener({
                affectsConfiguration: () => true
            } as vscode.ConfigurationChangeEvent);
            await new Promise(resolve => setTimeout(resolve, 0));

            let deactivated = false;
            deactivation = extension.deactivate().then(() => { deactivated = true; });
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.strictEqual(deactivated, false, 'deactivation must wait for a config reload already in flight');
            releaseReload();
            await Promise.all([reload, deactivation]);
            assert.strictEqual(watcherStartCalls, 1, 'config reload must not restart watchers after deactivation');
        } finally {
            releaseReload();
            await Promise.allSettled([reload, deactivation].filter((task): task is Promise<void> => task !== undefined));
            vscode.commands.registerCommand = originalRegisterCommand;
            vscode.window.createStatusBarItem = originalStatusBar;
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
            (vscode.workspace as unknown as { onDidChangeConfiguration: typeof vscode.workspace.onDidChangeConfiguration })
                .onDidChangeConfiguration = originalOnDidChangeConfiguration;
            ConfigManager.prototype.setWorkspaceFolders = originalSetFolders;
            ConfigManager.prototype.getScanConfig = originalGetConfig;
            FileWatcher.prototype.start = originalWatcherStart;
            FileScanner.prototype.scanWorkspace = originalScan;
        }
    });

    test('logs dynamic extension version and prompts for folder in multi-root createProjectConfig with existing-file feedback', async () => {
        const originalRegisterCommand = vscode.commands.registerCommand;
        const originalStatusBar = vscode.window.createStatusBarItem;
        const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
        const originalCreateOutputChannel = vscode.window.createOutputChannel;
        const originalShowWorkspaceFolderPick = vscode.window.showWorkspaceFolderPick;
        const originalShowInformationMessage = vscode.window.showInformationMessage;
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        const originalStat = vscode.workspace.fs.stat;
        const originalWriteFile = vscode.workspace.fs.writeFile;
        const originalSetFolders = ConfigManager.prototype.setWorkspaceFolders;
        const originalGetConfig = ConfigManager.prototype.getScanConfig;
        const originalWatcherStart = FileWatcher.prototype.start;
        const originalScan = FileScanner.prototype.scanWorkspace;

        const outputLines: string[] = [];
        const infoMessages: string[] = [];
        let createConfigHandler: (() => Promise<void>) | undefined;
        let wroteConfig = false;

        vscode.window.createOutputChannel = (() => ({
            appendLine: (line: string) => outputLines.push(line),
            show: () => undefined,
            dispose: () => undefined
        })) as unknown as typeof vscode.window.createOutputChannel;
        vscode.commands.registerCommand = ((command: string, callback: (...args: unknown[]) => unknown) => {
            if (command === 'restfulToolkit.createProjectConfig') {
                createConfigHandler = callback as () => Promise<void>;
            }
            return { dispose: () => undefined };
        }) as typeof vscode.commands.registerCommand;
        vscode.window.createStatusBarItem = (() => ({
            text: '', show: () => undefined, hide: () => undefined, dispose: () => undefined
        })) as typeof vscode.window.createStatusBarItem;
        vscode.workspace.createFileSystemWatcher = ((() => ({
            onDidCreate: () => ({ dispose: () => undefined }),
            onDidChange: () => ({ dispose: () => undefined }),
            onDidDelete: () => ({ dispose: () => undefined }),
            dispose: () => undefined
        })) as unknown) as typeof vscode.workspace.createFileSystemWatcher;

        const folderOne = { name: 'one', index: 0, uri: vscode.Uri.file('/workspace/one') } as vscode.WorkspaceFolder;
        const folderTwo = { name: 'two', index: 1, uri: vscode.Uri.file('/workspace/two') } as vscode.WorkspaceFolder;
        (vscode.workspace as unknown as { workspaceFolders: vscode.WorkspaceFolder[] }).workspaceFolders = [folderOne, folderTwo];

        let pickCalls = 0;
        vscode.window.showWorkspaceFolderPick = (async () => {
            pickCalls++;
            return folderTwo;
        }) as typeof vscode.window.showWorkspaceFolderPick;
        vscode.window.showInformationMessage = (async (message: string) => {
            infoMessages.push(message);
            return undefined;
        }) as unknown as typeof vscode.window.showInformationMessage;
        // Simulate existing .restful-toolkit.json in folderTwo
        vscode.workspace.fs.stat = (async () => ({ type: vscode.FileType.File, ctime: 0, mtime: 0, size: 10 })) as typeof vscode.workspace.fs.stat;
        vscode.workspace.fs.writeFile = async () => { wroteConfig = true; };

        ConfigManager.prototype.setWorkspaceFolders = async () => undefined;
        ConfigManager.prototype.getScanConfig = () => ({
            scanPaths: ['**/*.java'], excludePaths: [], maxResults: 100
        });
        FileWatcher.prototype.start = () => undefined;
        FileScanner.prototype.scanWorkspace = async () => undefined;

        const context = {
            subscriptions: [],
            extension: { packageJSON: { version: '9.8.7' } }
        } as unknown as vscode.ExtensionContext;
        const extension = await import('../extension');
        try {
            await extension.activate(context);
            assert.ok(
                outputLines.some(line => line.includes('RestfulToolkit v9.8.7 loaded')),
                'activation log should reflect context.extension.packageJSON.version'
            );
            assert.ok(createConfigHandler, 'createProjectConfig command must be registered');

            await createConfigHandler!();
            assert.strictEqual(pickCalls, 1, 'multi-root workspace must prompt showWorkspaceFolderPick');
            assert.strictEqual(wroteConfig, false, 'existing config file must not be overwritten');
            assert.strictEqual(infoMessages.length, 1, 'existing config file must show user feedback');
            assert.ok(infoMessages[0].includes('.restful-toolkit.json'));
        } finally {
            await extension.deactivate();
            vscode.commands.registerCommand = originalRegisterCommand;
            vscode.window.createStatusBarItem = originalStatusBar;
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
            vscode.window.createOutputChannel = originalCreateOutputChannel;
            vscode.window.showWorkspaceFolderPick = originalShowWorkspaceFolderPick;
            vscode.window.showInformationMessage = originalShowInformationMessage;
            (vscode.workspace as unknown as { workspaceFolders: typeof originalWorkspaceFolders }).workspaceFolders = originalWorkspaceFolders;
            vscode.workspace.fs.stat = originalStat;
            vscode.workspace.fs.writeFile = originalWriteFile;
            ConfigManager.prototype.setWorkspaceFolders = originalSetFolders;
            ConfigManager.prototype.getScanConfig = originalGetConfig;
            FileWatcher.prototype.start = originalWatcherStart;
            FileScanner.prototype.scanWorkspace = originalScan;
        }
    });
});
