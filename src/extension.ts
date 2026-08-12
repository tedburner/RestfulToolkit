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

let cache: EndpointCache;
let scanner: FileScanner;
let watcher: FileWatcher;
let logger: Logger;
let searchUI: SearchUI;
let configManager: ConfigManager;
let scanStateManager: ScanStateManager;
let baseUrlConfigWatcher: vscode.FileSystemWatcher | undefined;
let initialScanPromise: Promise<void> | undefined;
let configChangeSubscription: vscode.Disposable | undefined;
let workspaceFoldersSubscription: vscode.Disposable | undefined;
let deactivating = false;
const lifecycleTasks = new Set<Promise<void>>();

function getWorkspaceFolderPaths(): string[] {
    return vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [];
}

async function reloadConfigAndRefreshWatchers(): Promise<void> {
    await configManager.setWorkspaceFolders(getWorkspaceFolderPaths());
    if (deactivating) {
        return;
    }
    const updatedConfig = configManager.getScanConfig();
    watcher.start(updatedConfig.scanPaths, updatedConfig.excludePaths);
    await scanner.refresh(true);
}

function requestWorkspaceReload(logMessage: string, taskDescription: string): void {
    logger.info(logMessage);
    BaseUrlResolver.reset();
    trackLifecycleTask(reloadConfigAndRefreshWatchers(), taskDescription);
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
    logger.info('=== RestfulToolkit v0.0.8 loaded ===');

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

    // 使用 ConfigManager 获取配置
    const config = configManager.getScanConfig();
    const scanPatterns = config.scanPaths;

    watcher.setOnCreate(async (uri) => {
        await scanner.scanFileDebounced(uri);
    });

    watcher.setOnChange(async (uri) => {
        await scanner.scanFileDebounced(uri);
    });

    watcher.setOnDelete((uri) => {
        scanner.removeFile(uri);
    });

    watcher.start(scanPatterns, config.excludePaths);

    configChangeSubscription = vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration('restfulToolkit')) {
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
        jsonToClassInFolderCommand, configChangeSubscription, workspaceFoldersSubscription, baseUrlConfigWatcher,
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
    watcher?.dispose();
    scanner?.dispose();
    await Promise.allSettled([
        ...lifecycleTasks,
        initialScanPromise ?? Promise.resolve(),
        scanner?.waitForIdle() ?? Promise.resolve()
    ]);
    lifecycleTasks.clear();
    initialScanPromise = undefined;
    ConfigManager.reset();
    BaseUrlResolver.reset();
    ScanStateManager.reset();
    Logger.reset();
}
