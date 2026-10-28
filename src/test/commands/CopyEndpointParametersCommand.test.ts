import * as assert from 'assert';
import * as vscode from 'vscode';
import { CopyEndpointParametersCommand } from '../../commands/CopyEndpointParametersCommand';
import { EndpointCopyInfo } from '../../models/types';

interface ExtractorStub {
    extract(
        document: vscode.TextDocument,
        position: vscode.Position,
        options?: { expandDto?: boolean }
    ): Promise<EndpointCopyInfo | null>;
    expandDtoFields(copyInfo: EndpointCopyInfo, document: vscode.TextDocument): Promise<EndpointCopyInfo>;
}

suite('CopyEndpointParametersCommand Test Suite', () => {
    const originalEditor = vscode.window.activeTextEditor;
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalWriteText = vscode.env.clipboard.writeText;
    const originalWarning = vscode.window.showWarningMessage;
    const originalInformation = vscode.window.showInformationMessage;

    function makeCopyInfo(overrides: Partial<EndpointCopyInfo>): EndpointCopyInfo {
        return {
            httpMethod: 'POST',
            contentType: 'json',
            path: '/api/users',
            parameters: [],
            framework: 'Spring',
            dtoFields: new Map(),
            ...overrides
        };
    }

    function stubEditor(): void {
        (vscode.window as unknown as { activeTextEditor: vscode.TextEditor | undefined }).activeTextEditor = {
            document: { uri: vscode.Uri.file('UserController.java') } as vscode.TextDocument,
            selection: { active: { line: 0, character: 0 } } as vscode.Selection
        } as vscode.TextEditor;
    }

    teardown(() => {
        (vscode.window as unknown as { activeTextEditor: vscode.TextEditor | undefined }).activeTextEditor = originalEditor;
        vscode.window.showQuickPick = originalShowQuickPick;
        vscode.env.clipboard.writeText = originalWriteText;
        vscode.window.showWarningMessage = originalWarning;
        vscode.window.showInformationMessage = originalInformation;
    });

    test('canceling the format picker must not expand DTO fields or touch the clipboard', async () => {
        stubEditor();
        let clipboardText: string | undefined;
        let warningShown = false;
        let extractCalls = 0;
        let expandCalls = 0;
        let quickPickOptions: unknown;
        vscode.window.showQuickPick = (async (items: unknown, options: unknown) => {
            quickPickOptions = options;
            void items;
            return undefined;
        }) as typeof vscode.window.showQuickPick;
        vscode.env.clipboard.writeText = async value => { clipboardText = value; };
        vscode.window.showWarningMessage = (async () => {
            warningShown = true;
            return undefined;
        }) as typeof vscode.window.showWarningMessage;

        const command = new CopyEndpointParametersCommand();
        const extractor: ExtractorStub = {
            extract: async () => {
                extractCalls++;
                return makeCopyInfo({
                    parameters: [
                        { name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
                    ]
                });
            },
            expandDtoFields: async info => {
                expandCalls++;
                return info;
            }
        };
        (command as unknown as { extractor: ExtractorStub }).extractor = extractor;

        await command.execute();

        assert.strictEqual(extractCalls, 1, 'the command must extract route information first');
        assert.strictEqual(expandCalls, 0, 'cancellation must short-circuit before any DTO file I/O');
        assert.strictEqual(clipboardText, undefined, 'cancellation must not write the clipboard');
        assert.strictEqual(warningShown, false, 'cancellation is a silent no-op, not a warning');
        assert.ok(quickPickOptions, 'the format picker must be presented');
    });

    test('the url-params format must not expand DTO fields', async () => {
        stubEditor();
        let clipboardText = '';
        let expandCalls = 0;
        vscode.window.showQuickPick = (async () => ({ value: 'url-params' })) as unknown as typeof vscode.window.showQuickPick;
        vscode.env.clipboard.writeText = async value => { clipboardText = value; };

        const command = new CopyEndpointParametersCommand();
        const extractor: ExtractorStub = {
            extract: async () => makeCopyInfo({
                contentType: 'url-params',
                parameters: [
                    { name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: false }
                ]
            }),
            expandDtoFields: async info => {
                expandCalls++;
                return info;
            }
        };
        (command as unknown as { extractor: ExtractorStub }).extractor = extractor;

        await command.execute();

        assert.strictEqual(expandCalls, 0, 'url-params output needs no DTO expansion and must skip the file I/O');
        assert.ok(clipboardText.includes('keyword'), 'the url-params output must reach the clipboard');
    });

    test('the json-body format expands DTO fields exactly once', async () => {
        stubEditor();
        let clipboardText = '';
        let expandCalls = 0;
        vscode.window.showQuickPick = (async () => ({ value: 'json-body' })) as unknown as typeof vscode.window.showQuickPick;
        vscode.env.clipboard.writeText = async value => { clipboardText = value; };

        const command = new CopyEndpointParametersCommand();
        const extractor: ExtractorStub = {
            extract: async () => makeCopyInfo({
                parameters: [
                    { name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
                ]
            }),
            expandDtoFields: async info => {
                expandCalls++;
                info.dtoFields.set('UserDto', [{ name: 'userName', type: 'String', originalName: 'user_name' }]);
                return info;
            }
        };
        (command as unknown as { extractor: ExtractorStub }).extractor = extractor;

        await command.execute();

        assert.strictEqual(expandCalls, 1, 'the DTO expansion runs once, after the format has been chosen');
        assert.ok(clipboardText.includes('userName'), 'the expanded DTO fields must reach the clipboard');
    });
});
