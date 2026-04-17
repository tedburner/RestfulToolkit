import * as vscode from 'vscode';
import { RestEndpoint } from '../models/types';
import { EndpointCache } from '../cache/EndpointCache';
import { Logger } from '../utils/Logger';

export class SearchUI {
    private cache: EndpointCache;
    private logger: Logger;

    constructor(cache: EndpointCache) {
        this.cache = cache;
        this.logger = Logger.getInstance();
    }

    async show(): Promise<void> {
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = '搜索 REST 端点 (路径、类名、方法名、HTTP 方法)';
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;

        const allEndpoints = this.cache.getAll();

        if (allEndpoints.length === 0) {
            vscode.window.showWarningMessage('No REST endpoints found. Please scan your project first.');
            quickPick.dispose();
            return;
        }

        const items = allEndpoints.map(endpoint => this.createQuickPickItem(endpoint));
        quickPick.items = items;

        quickPick.onDidChangeValue((value) => {
            const filteredItems = this.filterEndpoints(allEndpoints, value);
            quickPick.items = filteredItems;
        });

        const selected = await new Promise<vscode.QuickPickItem | undefined>((resolve) => {
            quickPick.onDidAccept(() => {
                resolve(quickPick.selectedItems[0]);
                quickPick.hide();
            });

            quickPick.onDidHide(() => {
                resolve(undefined);
                quickPick.dispose();
            });

            quickPick.show();
        });

        if (selected) {
            await this.openEndpoint(selected as EndpointQuickPickItem);
        }
    }

    private createQuickPickItem(endpoint: RestEndpoint): EndpointQuickPickItem {
        const methodIcon = this.getMethodIcon(endpoint.method);
        const label = `${methodIcon} [${endpoint.method}] ${endpoint.path} - ${endpoint.className}.${endpoint.methodName}()`;
        const description = endpoint.file;
        const detail = endpoint.framework;

        return {
            label,
            description,
            detail,
            endpoint,
            alwaysShow: true
        };
    }

    private getMethodIcon(method: string): string {
        switch (method) {
            case 'GET':
                return '🟢';
            case 'POST':
                return '🔵';
            case 'PUT':
                return '🟡';
            case 'DELETE':
                return '🔴';
            case 'PATCH':
                return '🟣';
            default:
                return '⚪';
        }
    }

    private filterEndpoints(endpoints: RestEndpoint[], query: string): EndpointQuickPickItem[] {
        if (!query || query.trim() === '') {
            return endpoints.map(endpoint => this.createQuickPickItem(endpoint));
        }

        const searchResults = this.cache.search({ text: query });

        const maxResults = vscode.workspace
            .getConfiguration('restfulToolkit')
            .get<number>('maxResults', 100);

        if (searchResults.length > maxResults) {
            vscode.window.showInformationMessage(
                `显示前 ${maxResults} 个结果，共找到 ${searchResults.length} 个匹配`
            );
        }

        return searchResults.slice(0, maxResults).map(endpoint => this.createQuickPickItem(endpoint));
    }

    private async openEndpoint(item: EndpointQuickPickItem): Promise<void> {
        const endpoint = item.endpoint;

        try {
            const document = await vscode.workspace.openTextDocument(endpoint.file);

            await vscode.window.showTextDocument(document, {
                preview: false,
                selection: new vscode.Range(
                    new vscode.Position(endpoint.line - 1, 0),
                    new vscode.Position(endpoint.line - 1, 100)
                )
            });

            this.logger.info(`Opened endpoint: ${endpoint.path} at ${endpoint.file}:${endpoint.line}`);

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to open file: ${endpoint.file}`, err);
            vscode.window.showErrorMessage(`无法打开文件: ${endpoint.file}`);
        }
    }
}

interface EndpointQuickPickItem extends vscode.QuickPickItem {
    endpoint: RestEndpoint;
}