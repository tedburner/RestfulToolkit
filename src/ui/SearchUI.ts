import * as vscode from 'vscode';
import { RestEndpoint } from '../models/types';
import { EndpointCache } from '../cache/EndpointCache';
import { Logger } from '../utils/Logger';
import { getLabels } from '../extractor/i18n';

interface ScanStateSource {
    isScanning(): boolean;
    onDidChangeScanState(listener: (active: boolean) => void): vscode.Disposable;
}

/**
 * 提供端点搜索选择器，并在后台索引状态变化时同步当前缓存结果。
 */
export class SearchUI implements vscode.Disposable {
    private cache: EndpointCache;
    private logger: Logger;
    private searchDebounceTimer: NodeJS.Timeout | undefined;
    private readonly scanState: ScanStateSource;

    constructor(cache: EndpointCache, scanState?: ScanStateSource) {
        this.cache = cache;
        this.logger = Logger.getInstance();
        this.scanState = scanState ?? {
            isScanning: () => false,
            onDidChangeScanState: () => ({ dispose: () => undefined })
        };
    }

    /**
     * 展示端点搜索选择器。
     *
     * 后台索引进行中允许先展示当前缓存；索引完成后会按当前查询刷新结果，若缓存仍为空则
     * 关闭选择器并提示用户。选择端点后会打开源码并跳转到对应行。
     */
    async show(): Promise<void> {
        const labels = getLabels();
        const quickPick = vscode.window.createQuickPick();
        (quickPick as vscode.QuickPick<vscode.QuickPickItem> & { sortByLabel?: boolean }).sortByLabel = false;
        quickPick.matchOnDescription = false;
        quickPick.matchOnDetail = false;
        const indexing = this.scanState.isScanning();
        quickPick.placeholder = indexing ? labels.searchIndexingPlaceholder : labels.searchPlaceholder;
        quickPick.busy = indexing;

        const maxResults = this.getMaxResults();
        const allEndpoints = this.cache.getAll().slice(0, maxResults);

        if (allEndpoints.length === 0 && !indexing) {
            vscode.window.showWarningMessage(labels.searchNoEndpoints);
            quickPick.dispose();
            return;
        }

        quickPick.items = allEndpoints.map(endpoint => this.createQuickPickItem(endpoint));
        const applyScanState = (active: boolean): void => {
            quickPick.busy = active;
            quickPick.placeholder = active ? labels.searchIndexingPlaceholder : labels.searchPlaceholder;
            if (!active) {
                quickPick.items = this.filterEndpoints(quickPick.value);
                if (this.cache.size() === 0) {
                    void vscode.window.showWarningMessage(labels.searchNoEndpoints);
                    quickPick.hide();
                }
            }
        };
        let scanStateSubscription: vscode.Disposable | undefined;

        quickPick.onDidChangeValue((value) => {
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
            }
            this.searchDebounceTimer = setTimeout(() => {
                quickPick.items = this.filterEndpoints(value);
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
                scanStateSubscription?.dispose();
                quickPick.dispose();
            });

            scanStateSubscription = this.scanState.onDidChangeScanState(applyScanState);
            quickPick.show();

            // 订阅后复查，避免扫描恰好在首次读取状态与监听器注册之间完成而丢失事件。
            const currentScanState = this.scanState.isScanning();
            if (currentScanState !== indexing) {
                applyScanState(currentScanState);
            }
        });

        if (selected) {
            await this.openEndpoint(selected as EndpointQuickPickItem);
        }
    }

    private createQuickPickItem(endpoint: RestEndpoint): EndpointQuickPickItem {
        const label = `[${endpoint.method}] ${endpoint.path} - ${endpoint.className}.${endpoint.methodName}()`;
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

    private filterEndpoints(query: string): EndpointQuickPickItem[] {
        const maxResults = this.getMaxResults();
        if (!query || query.trim() === '') {
            return this.cache.getAll().slice(0, maxResults).map(endpoint => this.createQuickPickItem(endpoint));
        }

        return this.cache.search({ text: query }, maxResults)
            .map(endpoint => this.createQuickPickItem(endpoint));
    }

    private getMaxResults(): number {
        const configured = vscode.workspace
            .getConfiguration('restfulToolkit')
            .get<number>('maxResults', 100) ?? 100;
        return Math.min(1000, Math.max(1, Math.floor(configured)));
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
