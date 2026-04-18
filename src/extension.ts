import * as vscode from 'vscode';
import { EndpointCache } from './cache/EndpointCache';
import { FileScanner } from './scanner/FileScanner';
import { FileWatcher } from './utils/FileWatcher';
import { Logger } from './utils/Logger';
import { SearchUI } from './ui/SearchUI';
import { ConfigManager } from './config/ConfigManager';

let cache: EndpointCache;
let scanner: FileScanner;
let watcher: FileWatcher;
let logger: Logger;
let searchUI: SearchUI;
let configManager: ConfigManager;

export async function activate(context: vscode.ExtensionContext) {
    logger = Logger.getInstance();
    logger.info('RestfulToolkit extension is now active!');

    // 初始化配置管理器
    configManager = ConfigManager.getInstance();

    // 设置工作区文件夹（用于加载项目配置）
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        configManager.setWorkspaceFolder(workspaceFolder);
    }

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

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'RestfulToolkit: Refreshing endpoints...',
                    cancellable: false
                },
                async () => {
                    await scanner.refresh();
                }
            );

            vscode.window.showInformationMessage(`Refreshed! Found ${cache.size()} endpoints.`);
        }
    );

    // 新增：创建项目配置文件命令
    const createConfigCommand = vscode.commands.registerCommand(
        'restfulToolkit.createProjectConfig',
        () => {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
                configManager.createProjectConfigTemplate(workspaceFolder);
            } else {
                vscode.window.showWarningMessage('No workspace folder opened');
            }
        }
    );

    context.subscriptions.push(searchCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(createConfigCommand);
    context.subscriptions.push(scanner);
    context.subscriptions.push(watcher);
    context.subscriptions.push(logger);
}

export function deactivate() {
    logger.info('RestfulToolkit extension deactivated');
}