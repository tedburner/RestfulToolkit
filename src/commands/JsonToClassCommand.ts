import * as vscode from 'vscode';
import { JsonClassGenerator } from '../generator/JsonClassGenerator';
import { TargetLanguage } from '../generator/JsonTypeMapper';
import { getLabels } from '../extractor/i18n';
import { toPascalCase } from '../extractor/NameTransformer';

export class JsonToClassCommand {
    private generator: JsonClassGenerator;

    constructor() {
        this.generator = new JsonClassGenerator();
    }

    async execute(): Promise<void> {
        const labels = getLabels();
        const json = await this.getJsonInput();

        if (!json) {
            vscode.window.showWarningMessage(labels.jsonToClassNoClipboard);
            return;
        }

        try {
            JSON.parse(json);
        } catch {
            vscode.window.showErrorMessage(labels.jsonToClassInvalidJson);
            return;
        }

        const language = await this.selectLanguage();
        if (!language) { return; }

        const className = await this.inputClassName(json);
        if (!className) { return; }

        const packageName = await this.inputPackageName();
        if (!packageName) { return; }

        try {
            const code = this.generator.generate(json, className, packageName, language);
            await this.saveFile(code, className, language);
            vscode.window.showInformationMessage(labels.jsonToClassSuccess);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to generate DTO class: ${message}`);
        }
    }

    private async getJsonInput(): Promise<string | undefined> {
        const editor = vscode.window.activeTextEditor;
        if (editor && !editor.selection.isEmpty) {
            return editor.document.getText(editor.selection);
        }
        return vscode.env.clipboard.readText();
    }

    private async selectLanguage(): Promise<TargetLanguage | undefined> {
        const labels = getLabels();
        const choice = await vscode.window.showQuickPick(
            [
                { label: 'Java', description: labels.jsonToClassJava, value: 'java' as TargetLanguage },
                { label: 'Kotlin', description: labels.jsonToClassKotlin, value: 'kotlin' as TargetLanguage }
            ],
            { placeHolder: labels.jsonToClassLanguage }
        );
        return choice?.value;
    }

    private async inputClassName(json: string): Promise<string | undefined> {
        const labels = getLabels();
        const parsed = JSON.parse(json);
        let defaultName = 'Dto';

        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
            const firstKey = Object.keys(parsed[0])[0];
            defaultName = firstKey ? toPascalCase(firstKey) : 'Dto';
        } else if (typeof parsed === 'object' && parsed !== null) {
            const firstKey = Object.keys(parsed)[0];
            defaultName = firstKey ? toPascalCase(firstKey) : 'Dto';
        }

        if (!defaultName.endsWith('Dto')) {
            defaultName += 'Dto';
        }

        return vscode.window.showInputBox({
            prompt: labels.jsonToClassClassName,
            value: defaultName,
            validateInput: (input) => {
                if (!input || !input.trim()) { return 'Class name cannot be empty'; }
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input)) { return 'Invalid Java class name'; }
                return null;
            }
        });
    }

    private async inputPackageName(): Promise<string | undefined> {
        const labels = getLabels();
        return vscode.window.showInputBox({
            prompt: labels.jsonToClassPackageName,
            value: 'com.example.dto',
            validateInput: (input) => {
                if (!input || !input.trim()) { return 'Package name cannot be empty'; }
                if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/.test(input)) { return 'Invalid package name'; }
                return null;
            }
        });
    }

    private async saveFile(code: string, className: string, language: TargetLanguage): Promise<void> {
        const extension = language === 'java' ? 'java' : 'kt';
        const fileName = `${className}.${extension}`;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const defaultUri = workspaceFolders && workspaceFolders.length > 0
            ? vscode.Uri.joinPath(workspaceFolders[0].uri, fileName)
            : vscode.Uri.file(fileName);

        const saveUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { [language === 'java' ? 'Java' : 'Kotlin']: [extension] },
            saveLabel: 'Save DTO Class'
        });

        if (!saveUri) { return; }

        const content = new TextEncoder().encode(code);
        await vscode.workspace.fs.writeFile(saveUri, content);

        const doc = await vscode.workspace.openTextDocument(saveUri);
        await vscode.window.showTextDocument(doc);
    }
}
