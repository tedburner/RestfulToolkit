import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileWatcher } from '../../utils/FileWatcher';

// 使用当前平台路径构造测试输入，避免 Windows 分隔符在 macOS/Linux 上破坏 path.relative 计算
const workspaceRoot = path.resolve('/repo');

function uri(relativePath: string): vscode.Uri {
    return { fsPath: path.join(workspaceRoot, relativePath) } as vscode.Uri;
}

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
            uri: { fsPath: workspaceRoot } as vscode.Uri,
            name: 'repo',
            index: 0
        })) as typeof vscode.workspace.getWorkspaceFolder;

        const watcher = new FileWatcher();
        let dispatchCount = 0;
        watcher.setOnChange(() => dispatchCount++);
        try {
            watcher.start([{ patterns: ['**/*.java'], excludePatterns: ['module/build/**'] }]);
            changeListener?.(uri('module/build/Generated.java'));
            changeListener?.(uri('module/src/main/java/Api.java'));
            assert.strictEqual(dispatchCount, 1);
        } finally {
            watcher.dispose();
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
            vscode.workspace.getWorkspaceFolder = originalGetWorkspaceFolder;
        }
    });

    test('does not dispatch changes for configured excluded paths', () => {
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
            uri: { fsPath: workspaceRoot } as vscode.Uri,
            name: 'repo',
            index: 0
        })) as typeof vscode.workspace.getWorkspaceFolder;

        const watcher = new FileWatcher();
        let dispatchCount = 0;
        watcher.setOnChange(() => dispatchCount++);
        try {
            (watcher as unknown as { start(scopes: Array<{ patterns: string[]; excludePatterns: string[] }>): void })
                .start([{ patterns: ['**/*.java'], excludePatterns: ['**/build/**', '**/src/test/**'] }]);
            changeListener?.(uri('module/build/Generated.java'));
            changeListener?.(uri('module/src/main/java/Api.java'));
            assert.strictEqual(dispatchCount, 1);
        } finally {
            watcher.dispose();
            vscode.workspace.createFileSystemWatcher = originalCreateWatcher;
            vscode.workspace.getWorkspaceFolder = originalGetWorkspaceFolder;
        }
    });
});
