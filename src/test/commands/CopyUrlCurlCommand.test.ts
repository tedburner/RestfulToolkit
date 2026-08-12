import * as assert from 'assert';
import * as vscode from 'vscode';
import { CopyCurlCommand } from '../../commands/CopyCurlCommand';
import { CopyUrlCommand } from '../../commands/CopyUrlCommand';
import { ConfigManager } from '../../config/ConfigManager';
import { EndpointCopyInfo } from '../../models/types';

interface ExtractorStub {
    extract(document: vscode.TextDocument, position: vscode.Position): Promise<EndpointCopyInfo | null>;
}

interface CommandWithExtractor {
    extractor: ExtractorStub;
}

suite('Copy URL/cURL Command Test Suite', () => {
    const copyInfo: EndpointCopyInfo = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/users/{id}',
        parameters: [
            {
                name: 'id', type: 'Long', source: 'path', originalCaseName: 'id', isRequired: true
            },
            {
                name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: false
            }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };

    function createEditor(): vscode.TextEditor {
        return {
            document: { uri: vscode.Uri.file('TestController.java') } as vscode.TextDocument,
            selection: { active: { line: 0, character: 0 } } as vscode.Selection
        } as vscode.TextEditor;
    }

    test('copies a generated full URL to the clipboard', async () => {
        const originalEditor = vscode.window.activeTextEditor;
        const originalGetBaseUrl = ConfigManager.prototype.getBaseUrlAsync;
        const originalWriteText = vscode.env.clipboard.writeText;
        let clipboardText = '';

        (vscode.window as unknown as { activeTextEditor: vscode.TextEditor | undefined }).activeTextEditor = createEditor();
        ConfigManager.prototype.getBaseUrlAsync = async () => 'http://localhost:9090';
        vscode.env.clipboard.writeText = async value => { clipboardText = value; };

        const command = new CopyUrlCommand();
        (command as unknown as CommandWithExtractor).extractor = {
            extract: async () => copyInfo
        };

        try {
            await command.execute();
            assert.strictEqual(
                clipboardText,
                'http://localhost:9090/api/users/{id}?keyword=',
                'the command must copy the URL generated from endpoint metadata and the resolved Base URL'
            );
        } finally {
            (vscode.window as unknown as { activeTextEditor: vscode.TextEditor | undefined }).activeTextEditor = originalEditor;
            ConfigManager.prototype.getBaseUrlAsync = originalGetBaseUrl;
            vscode.env.clipboard.writeText = originalWriteText;
        }
    });

    test('copies a generated cURL command to the clipboard', async () => {
        const originalEditor = vscode.window.activeTextEditor;
        const originalGetBaseUrl = ConfigManager.prototype.getBaseUrlAsync;
        const originalWriteText = vscode.env.clipboard.writeText;
        let clipboardText = '';

        (vscode.window as unknown as { activeTextEditor: vscode.TextEditor | undefined }).activeTextEditor = createEditor();
        ConfigManager.prototype.getBaseUrlAsync = async () => 'http://localhost:9090';
        vscode.env.clipboard.writeText = async value => { clipboardText = value; };

        const command = new CopyCurlCommand();
        (command as unknown as CommandWithExtractor).extractor = {
            extract: async () => copyInfo
        };

        try {
            await command.execute();
            assert.ok(clipboardText.includes('curl -X GET'));
            assert.ok(clipboardText.includes('http://localhost:9090/api/users/{id}?keyword='));
        } finally {
            (vscode.window as unknown as { activeTextEditor: vscode.TextEditor | undefined }).activeTextEditor = originalEditor;
            ConfigManager.prototype.getBaseUrlAsync = originalGetBaseUrl;
            vscode.env.clipboard.writeText = originalWriteText;
        }
    });
});
