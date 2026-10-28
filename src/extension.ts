import * as vscode from 'vscode';
import { EndpointCache } from './cache/EndpointCache';
import { FileScanner } from './scanner/FileScanner';
import { FileWatcher } from './utils/FileWatcher';
import { Logger } from './utils/Logger';
import { SearchUI } from './ui/SearchUI';
import { ConfigManager } from './config/ConfigManager';
import { ScanStateManager } from './cache/ScanStateManager';
import { CopyEndpointParametersCommand } from './commands/CopyEndpointParametersCommand';
import { CopyUrlCommand } from './commands/CopyUrlCommand';
import { CopyCurlCommand } from './commands/CopyCurlCommand';
import { JsonToClassCommand } from './commands/JsonToClassCommand';
import { getLabels } from './extractor/i18n';
import { BaseUrlResolver } from './utils/BaseUrlResolver';
import { WatcherScope } from './utils/FileWatcher';

let cache: EndpointCache;
let scanner: FileScanner;
let watcher: FileWatcher;
let logger: Logger;
let searchUI: SearchUI;
let configManager: ConfigManager;
let scanStateManager: ScanStateManager;
let baseUrlConfigWatcher: vscode.FileSystemWatcher | undefined;
let projectConfigWatcher: vscode.FileSystemWatcher | undefined;
let initialScanPromise: Promise<void> | undefined;
let configChangeSubscription: vscode.Disposable | undefined;
let workspaceFoldersSubscription: vscode.Disposable | undefined;
let deactivating = false;
let configReloadActive = false;
let configReloadQueued = false;
const lifecycleTasks = new Set<Promise<void>>();

function getWorkspaceFolderPaths(): string[] {
    return vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [];
}

/**
 * 按当前配置重建 watcher：多根工作区每个根使用自己的扫描与排除模式。
 */
function startWatcherWithCurrentConfig(): void {
    const folderConfigs = configManager.getFolderScanConfigs();
    const scopes: WatcherScope[] = folderConfigs.length > 0
        ? folderConfigs.map(folderConfig => ({
            folderUri: folderConfig.folder,
            patterns: folderConfig.scanPaths,
            excludePatterns: folderConfig.excludePaths
        }))
        : (() => {
            const config = configManager.getScanConfig();
            return [{ patterns: config.scanPaths, excludePatterns: config.excludePaths }];
        })();
    watcher.start(scopes);
}

async function reloadConfigAndRefreshWatchers(): Promise<void> {
    await configManager.setWorkspaceFolders(getWorkspaceFolderPaths());
    if (deactivating) {
        return;
    }
    startWatcherWithCurrentConfig();
    await scanner.refresh(true);
}

/**
 * 请求配置重载；并发请求合并为一次执行 + 一次排队执行，避免重复重建 watcher
 * 与重复全量刷新。
 */
function requestWorkspaceReload(logMessage: string, taskDescription: string): void {
    logger.info(logMessage);
    BaseUrlResolver.reset();
    if (configReloadActive) {
        configReloadQueued = true;
        return;
    }
    configReloadActive = true;
    trackLifecycleTask((async () => {
        try {
            do {
                configReloadQueued = false;
                try {
                    await reloadConfigAndRefreshWatchers();
                } catch (error) {
                    if (!configReloadQueued || deactivating) {
                        throw error;
                    }
                    logger.error('Configuration reload failed; continuing with queued reload', error instanceof Error ? error : new Error(String(error)));
                }
            } while (configReloadQueued && !deactivating);
        } finally {
            configReloadActive = false;
        }
    })(), taskDescription);
}

function trackLifecycleTask(task: Promise<void>, description: string): void {
    const tracked = task
        .catch(error => {
            if (!deactivating) {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error(`${description} failed`, err);
            }
        })
        .finally(() => lifecycleTasks.delete(tracked));
    lifecycleTasks.add(tracked);
}

export async function activate(context: vscode.ExtensionContext) {
    deactivating = false;
    lifecycleTasks.clear();
    logger = Logger.getInstance();
    logger.info('=== RestfulToolkit v0.0.9 loaded ===');

    // 初始化配置管理器
    configManager = ConfigManager.getInstance();

    // 初始化纯内存扫描状态管理器
    scanStateManager = ScanStateManager.getInstance();

    // 设置工作区文件夹（用于加载项目配置）
    await configManager.setWorkspaceFolders(getWorkspaceFolderPaths());

    cache = new EndpointCache();
    scanner = new FileScanner(cache);
    watcher = new FileWatcher();
    searchUI = new SearchUI(cache, scanner);

    watcher.setOnCreate(async (uri) => {
        await scanner.scanFileDebounced(uri);
    });

    watcher.setOnChange(async (uri) => {
        await scanner.scanFileDebounced(uri);
    });

    watcher.setOnDelete((uri) => {
        scanner.removeFile(uri);
    });

    startWatcherWithCurrentConfig();

    configChangeSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('restfulToolkit')) {
            return;
        }
        // 只有扫描范围变化需要重载并全量刷新；maxResults/baseUrl 等每次读取都是实时值
        if (!event.affectsConfiguration('restfulToolkit.scanPaths')
            && !event.affectsConfiguration('restfulToolkit.excludePaths')) {
            logger.info('RestfulToolkit non-scan configuration changed; live values apply without a rescan');
            return;
        }
        requestWorkspaceReload(
            'RestfulToolkit configuration changed; rebuilding watchers and refreshing endpoints',
            'Configuration reload'
        );
    });

    workspaceFoldersSubscription = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        requestWorkspaceReload(
            'RestfulToolkit workspace folders changed; reloading project config and refreshing endpoints',
            'Workspace folder reload'
        );
    });

    baseUrlConfigWatcher = vscode.workspace.createFileSystemWatcher(
        '**/main/resources/{application,application-*,bootstrap}.{yml,yaml,properties}'
    );
    const invalidateBaseUrl = (uri: vscode.Uri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            BaseUrlResolver.invalidate(workspaceFolder.uri.fsPath);
        }
    };
    baseUrlConfigWatcher.onDidCreate(invalidateBaseUrl);
    baseUrlConfigWatcher.onDidChange(invalidateBaseUrl);
    baseUrlConfigWatcher.onDidDelete(invalidateBaseUrl);

    projectConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.restful-toolkit.json');
    const reloadProjectConfig = (uri: vscode.Uri) => {
        if (vscode.workspace.getWorkspaceFolder(uri)) {
            requestWorkspaceReload(
                `Project configuration changed: ${uri.fsPath}; reloading configuration and endpoints`,
                'Project configuration reload'
            );
        }
    };
    projectConfigWatcher.onDidCreate(reloadProjectConfig);
    projectConfigWatcher.onDidChange(reloadProjectConfig);
    projectConfigWatcher.onDidDelete(reloadProjectConfig);

    const searchCommand = vscode.commands.registerCommand(
        'restfulToolkit.searchEndpoints',
        async () => {
            logger.info('Search endpoints command executed');
            await searchUI.show();
        }
    );

    const refreshCommand = vscode.commands.registerCommand(
        'restfulToolkit.refreshEndpoints',
        async () => {
            logger.info('Refresh endpoints command executed');
            const labels = getLabels();

            const choice = await vscode.window.showQuickPick(
                [
                    {
                        label: labels.refreshIncrementalLabel,
                        description: labels.refreshIncrementalDesc,
                        detail: labels.refreshIncrementalDetail,
                        value: 'incremental'
                    },
                    {
                        label: labels.refreshFullLabel,
                        description: labels.refreshFullDesc,
                        detail: labels.refreshFullDetail,
                        value: 'full'
                    }
                ],
                {
                    placeHolder: labels.refreshPlaceholder,
                    matchOnDescription: true
                }
            );

            if (!choice) {
                logger.info('Refresh cancelled by user');
                return;
            }

            if (deactivating) {
                return;
            }

            const forceFullScan = choice.value === 'full';

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: forceFullScan ? labels.refreshProgressFull : labels.refreshProgressIncremental,
                    cancellable: false
                },
                async () => {
                    await scanner.refresh(forceFullScan);
                }
            );

            const stats = scanStateManager.getStats();
            const message = forceFullScan
                ? labels.refreshCompleteFull.replace('{0}', String(cache.size()))
                : labels.refreshCompleteIncremental.replace('{0}', String(cache.size())).replace('{1}', String(stats.totalFiles));

            vscode.window.showInformationMessage(message);
        }
    );

    // 新增：创建项目配置文件命令
    const createConfigCommand = vscode.commands.registerCommand(
        'restfulToolkit.createProjectConfig',
        async () => {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
                await configManager.createProjectConfigTemplate(workspaceFolder);
            } else {
                vscode.window.showWarningMessage('No workspace folder opened');
            }
        }
    );

    const copyCommand = vscode.commands.registerCommand(
        'restfulToolkit.copyEndpointParameters',
        async () => {
            logger.info('Copy endpoint parameters command executed');
            const cmd = new CopyEndpointParametersCommand();
            await cmd.execute();
        }
    );

    const copyUrlCommand = vscode.commands.registerCommand(
        'restfulToolkit.copyUrl',
        async () => {
            logger.info('Copy URL command executed');
            const cmd = new CopyUrlCommand();
            await cmd.execute();
        }
    );

    const copyCurlCommand = vscode.commands.registerCommand(
        'restfulToolkit.copyCurl',
        async () => {
            logger.info('Copy as cURL command executed');
            const cmd = new CopyCurlCommand();
            await cmd.execute();
        }
    );

    const jsonToClassInFolderCommand = vscode.commands.registerCommand(
        'restfulToolkit.jsonToClassInFolder',
        async (folderUri: vscode.Uri) => {
            logger.info('JSON to DTO Class in folder executed: ' + folderUri.fsPath);
            const cmd = new JsonToClassCommand();
            await cmd.executeInFolder(folderUri);
        }
    );

    context.subscriptions.push(
        searchCommand, refreshCommand, createConfigCommand, copyCommand, copyUrlCommand, copyCurlCommand,
        jsonToClassInFolderCommand, configChangeSubscription, workspaceFoldersSubscription, baseUrlConfigWatcher, projectConfigWatcher,
        scanner, watcher, searchUI, logger
    );

    initialScanPromise = scanner.scanWorkspace().catch(error => {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Initial background scan failed', err);
    });
}

export async function deactivate() {
    deactivating = true;
    logger?.info('RestfulToolkit extension deactivated');
    configChangeSubscription?.dispose();
    configChangeSubscription = undefined;
    workspaceFoldersSubscription?.dispose();
    workspaceFoldersSubscription = undefined;
    baseUrlConfigWatcher?.dispose();
    baseUrlConfigWatcher = undefined;
    projectConfigWatcher?.dispose();
    projectConfigWatcher = undefined;
    watcher?.dispose();
    // dispose 会清空防抖定时器与待处理队列，必须先让扫描器收束再释放，否则停用时的等待形同虚设
    await Promise.allSettled([
        ...lifecycleTasks,
        initialScanPromise ?? Promise.resolve()
    ]);
    await Promise.allSettled([scanner?.waitForIdle() ?? Promise.resolve()]);
    scanner?.dispose();
    lifecycleTasks.clear();
    initialScanPromise = undefined;
    ConfigManager.reset();
    BaseUrlResolver.reset();
    ScanStateManager.reset();
    Logger.reset();
}
