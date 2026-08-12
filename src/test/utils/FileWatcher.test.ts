import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileWatcher } from '../../utils/FileWatcher';

suite('FileWatcher Test Suite', () => {
    test('matches relative exclude globs against the containing workspace folder', () => {
        const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
        const originalGetWorkspaceFolder = vscode.workspace.getWorkspaceFolder;
        let changeListener: ((uri: vscode.Uri) => void) | undefined;
        vscode.workspace.createFileSystemWatcher = ((() => ({
            onDidCreate: () => ({ dispose: () => undefined }),
            onDidChange: (listener: (uri: vscode.Uri) => void) => {
                changeListener = listener;
                return { dispose: () => undefined };
            },
            onDidDelete: () => ({ dispose: () => undefined }),
            dispose: () => undefined
        })) as unknown) as typeof vscode.workspace.createFileSystemWatcher;
        vscode.workspace.getWorkspaceFolder = (() => ({
            uri: { fsPath: 'C:\\repo' } as vscode.Uri,
            name: 'repo',
            index: 0
        })) as typeof vscode.workspace.getWorkspaceFolder;

        const watcher = new FileWatcher();
        let dispatchCount = 0;
        watcher.setOnChange(() => dispatchCount++);
        try {
            watcher.start(['**/*.java'], ['module/build/**']);
            changeListener?.({ fsPath: 'C:\\repo\\module\\build\\Generated.java' } as vscode.Uri);
            changeListener?.({ fsPath: 'C:\\repo\\module\\src\\main\\java\\Api.java' } as vscode.Uri);
            assert.strictEqual(dispatchCount, 1);
        } finally {
            watcher.dispose();
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
            vscode.workspace.getWorkspaceFolder = originalGetWorkspaceFolder;
        }
    });

    test('does not dispatch changes for configured excluded paths', () => {
        const originalCreateWatcher = vscode.workspace.createFileSystemWatcher;
        let changeListener: ((uri: vscode.Uri) => void) | undefined;
        vscode.workspace.createFileSystemWatcher = ((() => ({
            onDidCreate: () => ({ dispose: () => undefined }),
            onDidChange: (listener: (uri: vscode.Uri) => void) => {
                changeListener = listener;
                return { dispose: () => undefined };
            },
            onDidDelete: () => ({ dispose: () => undefined }),
            dispose: () => undefined
        })) as unknown) as typeof vscode.workspace.createFileSystemWatcher;

        const watcher = new FileWatcher();
        let dispatchCount = 0;
        watcher.setOnChange(() => dispatchCount++);
        try {
            (watcher as unknown as { start(patterns: string[], excludePatterns: string[]): void })
                .start(['**/*.java'], ['**/build/**', '**/src/test/**']);
            changeListener?.({ fsPath: 'C:\\repo\\module\\build\\Generated.java' } as vscode.Uri);
            changeListener?.({ fsPath: 'C:\\repo\\module\\src\\main\\java\\Api.java' } as vscode.Uri);
            assert.strictEqual(dispatchCount, 1);
        } finally {
            watcher.dispose();
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
        }
    });
});
