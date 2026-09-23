import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigManager } from '../../config/ConfigManager';

suite('ConfigManager Resource Scope Test Suite', () => {
    test('uses the project config belonging to the resource workspace folder', async () => {
        const originalReadFile = vscode.workspace.fs.readFile;
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        const originalGetWorkspaceFolder = vscode.workspace.getWorkspaceFolder;
        const manager = ConfigManager.getInstance();
        const configContent = new Map<string, string>([
            ['C:\\workspace\\one\\.restful-toolkit.json', '{"baseUrl":"http://one.test","maxResults":11}'],
            ['C:\\workspace\\two\\.restful-toolkit.json', '{"baseUrl":"http://two.test","maxResults":22}']
        ]);
        vscode.workspace.fs.readFile = async (uri: vscode.Uri) => Buffer.from(configContent.get(uri.fsPath) ?? '', 'utf8');
        vscode.workspace.getConfiguration = (() => ({ inspect: () => undefined }) as unknown) as typeof vscode.workspace.getConfiguration;
        vscode.workspace.getWorkspaceFolder = ((uri: vscode.Uri) => ({
            uri: { fsPath: uri.fsPath.startsWith('C:\\workspace\\one') ? 'C:\\workspace\\one' : 'C:\\workspace\\two' }
        } as vscode.WorkspaceFolder)) as typeof vscode.workspace.getWorkspaceFolder;

        try {
            await manager.setWorkspaceFolders(['C:\\workspace\\one', 'C:\\workspace\\two']);
            const one = manager.getScanConfig({ fsPath: 'C:\\workspace\\one\\src\\Api.java' } as vscode.Uri);
            const two = manager.getScanConfig({ fsPath: 'C:\\workspace\\two\\src\\Api.java' } as vscode.Uri);
            assert.strictEqual(one.baseUrl, 'http://one.test');
            assert.strictEqual(one.maxResults, 11);
            assert.strictEqual(two.baseUrl, 'http://two.test');
            assert.strictEqual(two.maxResults, 22);
        } finally {
            vscode.workspace.fs.readFile = originalReadFile;
            vscode.workspace.getConfiguration = originalGetConfiguration;
            vscode.workspace.getWorkspaceFolder = originalGetWorkspaceFolder;
            ConfigManager.reset();
        }
    });
});
