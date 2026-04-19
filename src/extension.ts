import * as vscode from 'vscode';
import { EndpointCache } from './cache/EndpointCache';
import { FileScanner } from './scanner/FileScanner';
import { FileWatcher } from './utils/FileWatcher';
import { Logger } from './utils/Logger';
import { SearchUI } from './ui/SearchUI';
import { ConfigManager } from './config/ConfigManager';
import { ScanStateManager } from './cache/ScanStateManager';

let cache: EndpointCache;
let scanner: FileScanner;
let watcher: FileWatcher;
let logger: Logger;
let searchUI: SearchUI;
let configManager: ConfigManager;
let scanStateManager: ScanStateManager;

export async function activate(context: vscode.ExtensionContext) {
    logger = Logger.getInstance();
    logger.info('RestfulToolkit extension is now active!');

    // 初始化配置管理器
    configManager = ConfigManager.getInstance();

    // 初始化扫描状态管理器（需要 context 用于持久化）
    scanStateManager = ScanStateManager.getInstance();
    scanStateManager.setContext(context);

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

            // 询问用户选择刷新模式
            const choice = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(sync) 增量刷新',
                        description: '仅扫描修改过的文件（推荐）',
                        detail: '快速、高效，适合日常使用',
                        value: 'incremental'
                    },
                    {
                        label: '$(refresh) 全量刷新',
                        description: '重新扫描所有文件',
                        detail: '完整、彻底，适合配置变化或怀疑缓存错误时',
                        value: 'full'
                    }
                ],
                {
                    placeHolder: '选择刷新模式',
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
                    title: forceFullScan ? 'RestfulToolkit: 全量刷新端点...' : 'RestfulToolkit: 增量刷新端点...',
                    cancellable: false
                },
                async () => {
                    await scanner.refresh(forceFullScan);
                }
            );

            const stats = scanStateManager.getStats();
            const message = forceFullScan
                ? `全量刷新完成！共找到 ${cache.size()} 个端点`
                : `增量刷新完成！共找到 ${cache.size()} 个端点（扫描 ${stats.totalFiles} 文件）`;

            vscode.window.showInformationMessage(message);
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