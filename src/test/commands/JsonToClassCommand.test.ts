import * as assert from 'assert';
import * as vscode from 'vscode';
import { JsonToClassCommand } from '../../commands/JsonToClassCommand';

suite('JsonToClassCommand Test Suite', () => {
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalShowInputBox = vscode.window.showInputBox;
    const originalReadText = vscode.env.clipboard.readText;
    const originalWriteFile = vscode.workspace.fs.writeFile;

    teardown(() => {
        vscode.window.showQuickPick = originalShowQuickPick;
        vscode.window.showInputBox = originalShowInputBox;
        vscode.env.clipboard.readText = originalReadText;
        vscode.workspace.fs.writeFile = originalWriteFile;
    });

    test('pressing Escape on the Lombok picker cancels DTO generation without prompting for class name', async () => {
        vscode.env.clipboard.readText = async () => '{"userName":"alice"}';
        let quickPickCalls = 0;
        let inputBoxCalls = 0;
        let wroteFile = false;

        vscode.window.showQuickPick = (async () => {
            quickPickCalls++;
            if (quickPickCalls === 1) {
                return { label: 'Java', value: 'java' };
            }
            // User presses Escape on Lombok picker
            return undefined;
        }) as unknown as typeof vscode.window.showQuickPick;
        vscode.window.showInputBox = (async () => {
            inputBoxCalls++;
            return 'UserDto';
        }) as typeof vscode.window.showInputBox;
        vscode.workspace.fs.writeFile = async () => { wroteFile = true; };

        const cmd = new JsonToClassCommand();
        await cmd.executeInFolder(vscode.Uri.file('/workspace/src/main/java/com/example/dto'));

        assert.strictEqual(quickPickCalls, 2);
        assert.strictEqual(inputBoxCalls, 0, 'canceling Lombok selection must stop before class name input');
        assert.strictEqual(wroteFile, false);
    });

    test('suggests valid Dto fallback when the first JSON key has no ASCII identifier characters', async () => {
        vscode.env.clipboard.readText = async () => '{"$":1,"中文":"ok"}';
        let quickPickCalls = 0;
        let suggestedValue: string | undefined;
        let validationResult: vscode.InputBoxValidationMessage | string | undefined | null;

        vscode.window.showQuickPick = (async () => {
            quickPickCalls++;
            if (quickPickCalls === 1) {
                return { label: 'Kotlin', value: 'kotlin' };
            }
            return undefined;
        }) as unknown as typeof vscode.window.showQuickPick;
        vscode.window.showInputBox = (async (options?: vscode.InputBoxOptions) => {
            suggestedValue = options?.value;
            validationResult = await options?.validateInput?.(suggestedValue ?? '');
            return undefined;
        }) as typeof vscode.window.showInputBox;

        const cmd = new JsonToClassCommand();
        await cmd.executeInFolder(vscode.Uri.file('/workspace/src/main/kotlin/com/example/dto'));

        assert.strictEqual(suggestedValue, 'Dto');
        assert.strictEqual(validationResult, null);
    });
});
