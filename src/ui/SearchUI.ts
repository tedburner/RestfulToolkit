import * as vscode from 'vscode';
import { RestEndpoint } from '../models/types';
import { EndpointCache } from '../cache/EndpointCache';
import { Logger } from '../utils/Logger';
import { getLabels } from '../extractor/i18n';

export class SearchUI implements vscode.Disposable {
    private cache: EndpointCache;
    private logger: Logger;
    private searchDebounceTimer: NodeJS.Timeout | undefined;

    constructor(cache: EndpointCache) {
        this.cache = cache;
        this.logger = Logger.getInstance();
    }

    async show(): Promise<void> {
        const labels = getLabels();
        const quickPick = vscode.window.createQuickPick();
        (quickPick as vscode.QuickPick<vscode.QuickPickItem> & { sortByLabel?: boolean }).sortByLabel = false;
        quickPick.matchOnDescription = false;
        quickPick.matchOnDetail = false;
        quickPick.placeholder = labels.searchPlaceholder;

        const allEndpoints = this.cache.getAll();

        if (allEndpoints.length === 0) {
            vscode.window.showWarningMessage(labels.searchNoEndpoints);
            quickPick.dispose();
            return;
        }

        // 初始显示全部端点（未输入搜索时）
        const items = allEndpoints.map(endpoint => this.createQuickPickItem(endpoint));
        quickPick.items = items;

        quickPick.onDidChangeValue((value) => {
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            this.searchDebounceTimer = setTimeout(() => {
                const filteredItems = this.filterEndpoints(value);
                quickPick.items = filteredItems;
            }, 150);
        });

        const selected = await new Promise<vscode.QuickPickItem | undefined>((resolve) => {
            quickPick.onDidAccept(() => {
                resolve(quickPick.selectedItems[0]);
                quickPick.hide();
            });

            quickPick.onDidHide(() => {
                if (this.searchDebounceTimer) {
                    clearTimeout(this.searchDebounceTimer);
                    this.searchDebounceTimer = undefined;
                }
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

    private filterEndpoints(query: string): EndpointQuickPickItem[] {
        if (!query || query.trim() === '') {
            return this.cache.getAll().map(endpoint => this.createQuickPickItem(endpoint));
        }

        const maxResults = vscode.workspace
            .getConfiguration('restfulToolkit')
            .get<number>('maxResults', 100);

        const searchResults = this.cache.search({ text: query }, maxResults);

        return searchResults.map(endpoint => this.createQuickPickItem(endpoint));
    }

    dispose(): void {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = undefined;
        }
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
            vscode.window.showErrorMessage(getLabels().searchOpenFileError.replace('{0}', endpoint.file));
        }
    }
}

interface EndpointQuickPickItem extends vscode.QuickPickItem {
    endpoint: RestEndpoint;
}
