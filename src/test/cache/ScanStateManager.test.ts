import * as assert from 'assert';
import * as vscode from 'vscode';
import { ScanStateManager } from '../../cache/ScanStateManager';

suite('ScanStateManager Test Suite', () => {
    const originalStat = vscode.workspace.fs.stat;

    teardown(() => {
        vscode.workspace.fs.stat = originalStat;
        ScanStateManager.reset();
    });

    test('rescans when size changes while mtime remains equal', async () => {
        const manager = ScanStateManager.getInstance();
        const recordScan = manager.recordScan as unknown as (
            filePath: string,
            endpointCount: number,
            mtime: number,
            size: number
        ) => Promise<void>;
        await recordScan.call(manager, 'C:\\workspace\\Controller.java', 1, 100, 10);
        vscode.workspace.fs.stat = async () => ({
            type: vscode.FileType.File,
            ctime: 0,
            mtime: 100,
            size: 20
        });

        const result = await manager.needsScan('C:\\workspace\\Controller.java');

        assert.strictEqual(result.needsScan, true);
    });

    test('rescans when mtime differs even if it moves backwards', async () => {
        const manager = ScanStateManager.getInstance();
        const recordScan = manager.recordScan as unknown as (
            filePath: string,
            endpointCount: number,
            mtime: number,
            size: number
        ) => Promise<void>;
        await recordScan.call(manager, 'C:\\workspace\\Controller.java', 1, 200, 10);
        vscode.workspace.fs.stat = async () => ({
            type: vscode.FileType.File,
            ctime: 0,
            mtime: 100,
            size: 10
        });

        const result = await manager.needsScan('C:\\workspace\\Controller.java');

        assert.strictEqual(result.needsScan, true);
    });
});
