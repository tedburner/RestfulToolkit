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
});
