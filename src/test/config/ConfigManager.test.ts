import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from '../../config/ConfigManager';
import { DEFAULT_CONFIG, PROJECT_CONFIG_FILE } from '../../config/ScanConfig';

suite('ConfigManager Test Suite', () => {
    const originalReadFile = vscode.workspace.fs.readFile;
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    const originalGetWorkspaceFolder = vscode.workspace.getWorkspaceFolder;

    teardown(() => {
        vscode.workspace.fs.readFile = originalReadFile;
        vscode.workspace.getConfiguration = originalGetConfiguration;
        vscode.workspace.getWorkspaceFolder = originalGetWorkspaceFolder;
        ConfigManager.reset();
    });

    function stubWorkspaceLookup(folders: string[] = []): void {
        vscode.workspace.getConfiguration = (() => ({ inspect: () => undefined }) as unknown) as typeof vscode.workspace.getConfiguration;
        // 与真实行为一致：把资源 URI 映射回所属工作区根目录
        vscode.workspace.getWorkspaceFolder = ((uri: vscode.Uri) => {
            const match = folders.find(folder => uri.fsPath === folder || uri.fsPath.startsWith(`${folder}/`));
            return match ? ({ uri: { fsPath: match } } as vscode.WorkspaceFolder) : undefined;
        }) as typeof vscode.workspace.getWorkspaceFolder;
    }

    test('uses the project config belonging to the resource workspace folder', async () => {
        const manager = ConfigManager.getInstance();
        const one = '/workspace/one';
        const two = '/workspace/two';
        // mock 键与生产代码使用相同的 path.join，保证在任意平台一致
        const configContent = new Map<string, string>([
            [path.join(one, PROJECT_CONFIG_FILE), '{"baseUrl":"http://one.test","maxResults":11}'],
            [path.join(two, PROJECT_CONFIG_FILE), '{"baseUrl":"http://two.test","maxResults":22}']
        ]);
        vscode.workspace.fs.readFile = async (uri: vscode.Uri) => Buffer.from(configContent.get(uri.fsPath) ?? '', 'utf8');
        stubWorkspaceLookup([one, two]);

        await manager.setWorkspaceFolders([one, two]);
        const oneConfig = manager.getScanConfig({ fsPath: `${one}/src/Api.java` } as vscode.Uri);
        const twoConfig = manager.getScanConfig({ fsPath: `${two}/src/Api.java` } as vscode.Uri);
        assert.strictEqual(oneConfig.baseUrl, 'http://one.test');
        assert.strictEqual(oneConfig.maxResults, 11);
        assert.strictEqual(twoConfig.baseUrl, 'http://two.test');
        assert.strictEqual(twoConfig.maxResults, 22);
    });

    test('discards a stale concurrent project config snapshot', async () => {
        const manager = ConfigManager.getInstance();
        const one = '/workspace/one';
        const two = '/workspace/two';
        const onePath = path.join(one, PROJECT_CONFIG_FILE);
        const twoPath = path.join(two, PROJECT_CONFIG_FILE);
        const configContent = new Map<string, string>([
            [onePath, '{"baseUrl":"http://one.test"}'],
            [twoPath, '{"baseUrl":"http://two.test"}']
        ]);
        let oneReads = 0;
        let releaseFirstRead!: () => void;
        const firstReadGate = new Promise<void>(resolve => { releaseFirstRead = resolve; });
        vscode.workspace.fs.readFile = async (uri: vscode.Uri) => {
            if (uri.fsPath === onePath) {
                oneReads++;
                if (oneReads === 1) {
                    // 第一轮加载读取 folder one 的迟到结果：返回已被取代的旧内容
                    await firstReadGate;
                    return Buffer.from('{"baseUrl":"http://stale.test"}', 'utf8');
                }
            }
            return Buffer.from(configContent.get(uri.fsPath) ?? '', 'utf8');
        };
        stubWorkspaceLookup([one, two]);

        const firstLoad = manager.setWorkspaceFolders([one]);
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.strictEqual(oneReads, 1, 'the first load must be blocked inside the delayed read');

        // 第二轮加载在同一轮事件循环内启动并完成；一轮完成后第一轮的迟到结果不得回写
        const secondLoad = manager.setWorkspaceFolders([one, two]);
        await secondLoad;
        releaseFirstRead();
        await firstLoad;

        const oneConfig = manager.getScanConfig({ fsPath: `${one}/src/Api.java` } as vscode.Uri);
        const twoConfig = manager.getScanConfig({ fsPath: `${two}/src/Api.java` } as vscode.Uri);
        assert.strictEqual(oneConfig.baseUrl, 'http://one.test', 'the newer snapshot must win over the stale read');
        assert.strictEqual(twoConfig.baseUrl, 'http://two.test', 'the newer snapshot must keep folders the stale load never saw');
    });

    test('synthesizes folder scan configs per workspace folder without merging them', async () => {
        const manager = ConfigManager.getInstance();
        const one = '/workspace/one';
        const two = '/workspace/two';
        const onePath = path.join(one, PROJECT_CONFIG_FILE);
        vscode.workspace.fs.readFile = async (uri: vscode.Uri) =>
            uri.fsPath === onePath
                ? Buffer.from('{"scanPaths":["**/custom/**/*.java"],"excludePaths":["**/custom/gen/**"]}', 'utf8')
                : Buffer.from('', 'utf8');
        // folder one 显式设置了 VS Code 扫描路径；folder two 没有任何设置
        vscode.workspace.getConfiguration = ((_section: string, folderUri?: vscode.Uri) => ({
            inspect: (key: string) => {
                if (folderUri?.fsPath === one && key === 'scanPaths') {
                    return { workspaceFolderValue: ['**/folder-setting/**/*.java'] };
                }
                return undefined;
            }
        })) as typeof vscode.workspace.getConfiguration;
        vscode.workspace.getWorkspaceFolder = ((uri: vscode.Uri) => ({
            uri: { fsPath: uri.fsPath }
        } as vscode.WorkspaceFolder)) as typeof vscode.workspace.getWorkspaceFolder;

        await manager.setWorkspaceFolders([one, two]);
        const folderConfigs = manager.getFolderScanConfigs();

        assert.strictEqual(folderConfigs.length, 2);
        assert.deepStrictEqual(
            folderConfigs[0].scanPaths,
            ['**/folder-setting/**/*.java'],
            'a folder-level VS Code setting wins over the project config of the same folder'
        );
        assert.deepStrictEqual(
            folderConfigs[0].excludePaths,
            ['**/custom/gen/**'],
            'without a VS Code setting the folder falls back to its own project config'
        );
        assert.deepStrictEqual(
            folderConfigs[1].scanPaths,
            DEFAULT_CONFIG.scanPaths,
            'a folder without settings or project config uses the defaults, not another folder\u2019s patterns'
        );
        assert.deepStrictEqual(folderConfigs[1].excludePaths, DEFAULT_CONFIG.excludePaths);
    });
});
