import * as assert from 'assert';
import * as vscode from 'vscode';
import { EndpointCache } from '../../cache/EndpointCache';
import { SearchUI } from '../../ui/SearchUI';

suite('SearchUI Test Suite', () => {
    test('refreshes picker items when background indexing completes', async () => {
        const originalCreateQuickPick = vscode.window.createQuickPick;
        let hiddenListener: (() => void) | undefined;
        let scanStateListener: ((active: boolean) => void) | undefined;
        const quickPick = {
            items: [] as vscode.QuickPickItem[], selectedItems: [], value: '', busy: false,
            matchOnDescription: false, matchOnDetail: false, placeholder: '',
            onDidChangeValue: () => ({ dispose: () => undefined }),
            onDidAccept: () => ({ dispose: () => undefined }),
            onDidHide: (listener: () => void) => { hiddenListener = listener; return { dispose: () => undefined }; },
            show: () => undefined,
            hide: () => undefined,
            dispose: () => undefined
        };
        vscode.window.createQuickPick = ((() => quickPick) as unknown) as typeof vscode.window.createQuickPick;

        const cache = new EndpointCache();
        type SearchUiConstructor = new (cache: EndpointCache, scanState: {
            isScanning(): boolean;
            onDidChangeScanState(listener: (active: boolean) => void): vscode.Disposable;
        }) => SearchUI;
        const ui = new (SearchUI as unknown as SearchUiConstructor)(cache, {
            isScanning: () => true,
            onDidChangeScanState: listener => {
                scanStateListener = listener;
                return { dispose: () => undefined };
            }
        });

        try {
            const showPromise = ui.show();
            cache.add({
                method: 'GET', path: '/api/users', className: 'UserController', methodName: 'list',
                file: 'UserController.java', line: 10, framework: 'Spring'
            });

            scanStateListener?.(false);

            assert.strictEqual(quickPick.busy, false);
            assert.strictEqual(quickPick.items.length, 1);
            assert.match(quickPick.items[0].label, /\/api\/users/);
            hiddenListener?.();
            await showPromise;
        } finally {
            ui.dispose();
            vscode.window.createQuickPick = originalCreateQuickPick;
        }
    });

    test('warns and closes the picker when indexing completes without endpoints', async () => {
        const originalCreateQuickPick = vscode.window.createQuickPick;
        const originalWarning = vscode.window.showWarningMessage;
        let hiddenListener: (() => void) | undefined;
        let scanStateListener: ((active: boolean) => void) | undefined;
        let warned = false;
        let hidden = false;
        const quickPick = {
            items: [] as vscode.QuickPickItem[], selectedItems: [], value: '', busy: false,
            matchOnDescription: false, matchOnDetail: false, placeholder: '',
            onDidChangeValue: () => ({ dispose: () => undefined }),
            onDidAccept: () => ({ dispose: () => undefined }),
            onDidHide: (listener: () => void) => { hiddenListener = listener; return { dispose: () => undefined }; },
            show: () => undefined,
            hide: () => { hidden = true; hiddenListener?.(); },
            dispose: () => undefined
        };
        vscode.window.createQuickPick = ((() => quickPick) as unknown) as typeof vscode.window.createQuickPick;
        vscode.window.showWarningMessage = (async () => { warned = true; return undefined; }) as typeof vscode.window.showWarningMessage;

        type SearchUiConstructor = new (cache: EndpointCache, scanState: {
            isScanning(): boolean;
            onDidChangeScanState(listener: (active: boolean) => void): vscode.Disposable;
        }) => SearchUI;
        const ui = new (SearchUI as unknown as SearchUiConstructor)(new EndpointCache(), {
            isScanning: () => true,
            onDidChangeScanState: listener => {
                scanStateListener = listener;
                return { dispose: () => undefined };
            }
        });

        try {
            const showPromise = ui.show();
            scanStateListener?.(false);
            await showPromise;

            assert.strictEqual(warned, true);
            assert.strictEqual(hidden, true);
        } finally {
            ui.dispose();
            vscode.window.createQuickPick = originalCreateQuickPick;
            vscode.window.showWarningMessage = originalWarning;
        }
    });

    test('refreshes when indexing completes before the scan-state listener is attached', async () => {
        const originalCreateQuickPick = vscode.window.createQuickPick;
        let hiddenListener: (() => void) | undefined;
        const quickPick = {
            items: [] as vscode.QuickPickItem[], selectedItems: [], value: '', busy: false,
            matchOnDescription: false, matchOnDetail: false, placeholder: '',
            onDidChangeValue: () => ({ dispose: () => undefined }),
            onDidAccept: () => ({ dispose: () => undefined }),
            onDidHide: (listener: () => void) => { hiddenListener = listener; return { dispose: () => undefined }; },
            show: () => undefined,
            hide: () => undefined,
            dispose: () => undefined
        };
        vscode.window.createQuickPick = ((() => quickPick) as unknown) as typeof vscode.window.createQuickPick;

        const cache = new EndpointCache();
        let scanningChecks = 0;
        type SearchUiConstructor = new (cache: EndpointCache, scanState: {
            isScanning(): boolean;
            onDidChangeScanState(listener: (active: boolean) => void): vscode.Disposable;
        }) => SearchUI;
        const ui = new (SearchUI as unknown as SearchUiConstructor)(cache, {
            isScanning: () => scanningChecks++ === 0,
            onDidChangeScanState: () => {
                cache.add({
                    method: 'GET', path: '/api/race', className: 'RaceController', methodName: 'get',
                    file: 'RaceController.java', line: 8, framework: 'Spring'
                });
                return { dispose: () => undefined };
            }
        });

        try {
            const showPromise = ui.show();
            assert.strictEqual(quickPick.busy, false);
            assert.strictEqual(quickPick.items.length, 1);
            assert.match(quickPick.items[0].label, /\/api\/race/);
            hiddenListener?.();
            await showPromise;
        } finally {
            ui.dispose();
            vscode.window.createQuickPick = originalCreateQuickPick;
        }
    });

    test('opens an empty busy picker while indexing instead of warning', async () => {
        const originalCreateQuickPick = vscode.window.createQuickPick;
        const originalWarning = vscode.window.showWarningMessage;
        let shown = false;
        let warned = false;
        let hiddenListener: (() => void) | undefined;
        const quickPick = {
            items: [], selectedItems: [], value: '', busy: false,
            matchOnDescription: false, matchOnDetail: false, placeholder: '',
            onDidChangeValue: () => ({ dispose: () => undefined }),
            onDidAccept: () => ({ dispose: () => undefined }),
            onDidHide: (listener: () => void) => { hiddenListener = listener; return { dispose: () => undefined }; },
            show: () => { shown = true; setTimeout(() => hiddenListener?.(), 0); },
            hide: () => undefined,
            dispose: () => undefined
        };
        vscode.window.createQuickPick = ((() => quickPick) as unknown) as typeof vscode.window.createQuickPick;
        vscode.window.showWarningMessage = (async () => { warned = true; return undefined; }) as typeof vscode.window.showWarningMessage;

        type SearchUiConstructor = new (cache: EndpointCache, scanState: {
            isScanning(): boolean;
            onDidChangeScanState(listener: (active: boolean) => void): vscode.Disposable;
        }) => SearchUI;
        const ui = new (SearchUI as unknown as SearchUiConstructor)(new EndpointCache(), {
            isScanning: () => true,
            onDidChangeScanState: () => ({ dispose: () => undefined })
        });
        try {
            await ui.show();
            assert.strictEqual(shown, true);
            assert.strictEqual(quickPick.busy, true);
            assert.strictEqual(warned, false);
        } finally {
            ui.dispose();
            vscode.window.createQuickPick = originalCreateQuickPick;
            vscode.window.showWarningMessage = originalWarning;
        }
    });

    test('limits initial picker items to configured maxResults', async () => {
        const originalCreateQuickPick = vscode.window.createQuickPick;
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        let hiddenListener: (() => void) | undefined;
        const quickPick = {
            items: [] as vscode.QuickPickItem[], selectedItems: [], value: '', busy: false,
            matchOnDescription: false, matchOnDetail: false, placeholder: '',
            onDidChangeValue: () => ({ dispose: () => undefined }),
            onDidAccept: () => ({ dispose: () => undefined }),
            onDidHide: (listener: () => void) => { hiddenListener = listener; return { dispose: () => undefined }; },
            show: () => setTimeout(() => hiddenListener?.(), 0), hide: () => undefined, dispose: () => undefined
        };
        vscode.window.createQuickPick = ((() => quickPick) as unknown) as typeof vscode.window.createQuickPick;
        vscode.workspace.getConfiguration = ((() => ({ get: () => 2 })) as unknown) as typeof vscode.workspace.getConfiguration;
        const cache = new EndpointCache();
        for (let i = 0; i < 5; i++) {
            cache.add({ method: 'GET', path: `/api/${i}`, className: 'Api', methodName: `get${i}`, file: `Api${i}.java`, line: i + 1, framework: 'Spring' });
        }
        const ui = new SearchUI(cache);
        try {
            await ui.show();
            assert.strictEqual(quickPick.items.length, 2);
        } finally {
            ui.dispose();
            vscode.window.createQuickPick = originalCreateQuickPick;
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
});
