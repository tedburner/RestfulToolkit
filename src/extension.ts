import * as vscode from 'vscode';
import { EndpointCache } from './cache/EndpointCache';
import { FileScanner } from './scanner/FileScanner';
import { FileWatcher } from './utils/FileWatcher';
import { Logger } from './utils/Logger';
import { SearchUI } from './ui/SearchUI';

let cache: EndpointCache;
let scanner: FileScanner;
let watcher: FileWatcher;
let logger: Logger;
let searchUI: SearchUI;

export async function activate(context: vscode.ExtensionContext) {
    logger = Logger.getInstance();
    logger.info('RestfulToolkit extension is now active!');

    cache = new EndpointCache();
    scanner = new FileScanner(cache);
    watcher = new FileWatcher();
    searchUI = new SearchUI(cache);

    const scanPatterns = vscode.workspace
        .getConfiguration('restfulToolkit')
        .get<string[]>('scanPaths', [
            'src/main/java/**/*.java',
            'src/main/kotlin/**/*.kt'
        ]);

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

    context.subscriptions.push(searchCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(scanner);
    context.subscriptions.push(watcher);
    context.subscriptions.push(logger);
}

export function deactivate() {
    logger.info('RestfulToolkit extension deactivated');
}