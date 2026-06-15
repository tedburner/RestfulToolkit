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

let cache: EndpointCache;
let scanner: FileScanner;
let watcher: FileWatcher;
let logger: Logger;
let searchUI: SearchUI;
let configManager: ConfigManager;
let scanStateManager: ScanStateManager;

function getWorkspaceFolderPaths(): string[] {
    return vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [];
}

async function reloadConfigAndRefreshWatchers(): Promise<void> {
    await configManager.setWorkspaceFolders(getWorkspaceFolderPaths());
    const updatedConfig = configManager.getScanConfig();
    watcher.start(updatedConfig.scanPaths);
    await scanner.refresh(true);
}

export async function activate(context: vscode.ExtensionContext) {
    logger = Logger.getInstance();
    logger.info('=== RestfulToolkit v0.0.7 loaded ===');

    // 初始化配置管理器
    configManager = ConfigManager.getInstance();

    // 初始化扫描状态管理器（需要 context 用于持久化）
    scanStateManager = ScanStateManager.getInstance();
    scanStateManager.setContext(context);

    // 设置工作区文件夹（用于加载项目配置）
    await configManager.setWorkspaceFolders(getWorkspaceFolderPaths());

    cache = new EndpointCache();
    scanner = new FileScanner(cache);
    watcher = new FileWatcher();
    searchUI = new SearchUI(cache);

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

    watcher.start(scanPatterns);

    await scanner.scanWorkspace();

    const configChangeSubscription = vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (!event.affectsConfiguration('restfulToolkit')) {
            return;
        }
        logger.info('RestfulToolkit configuration changed; rebuilding watchers and refreshing endpoints');
        await reloadConfigAndRefreshWatchers();
    });

    const workspaceFoldersSubscription = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        logger.info('RestfulToolkit workspace folders changed; reloading project config and refreshing endpoints');
        await reloadConfigAndRefreshWatchers();
    });

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

    context.subscriptions.push(searchCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(createConfigCommand);
    context.subscriptions.push(copyCommand);
    context.subscriptions.push(copyUrlCommand);
    context.subscriptions.push(copyCurlCommand);
    context.subscriptions.push(jsonToClassInFolderCommand);
    context.subscriptions.push(configChangeSubscription);
    context.subscriptions.push(workspaceFoldersSubscription);
    context.subscriptions.push(scanner);
    context.subscriptions.push(watcher);
    context.subscriptions.push(searchUI);
    context.subscriptions.push(logger);
}

export async function deactivate() {
    logger?.info('RestfulToolkit extension deactivated');
    ConfigManager.reset();
    ScanStateManager.reset();
    Logger.reset();
}
