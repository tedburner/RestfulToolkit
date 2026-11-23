import * as vscode from 'vscode';
import { JsonClassGenerator } from '../generator/JsonClassGenerator';
import { TargetLanguage } from '../generator/JsonTypeMapper';
import { getLabels } from '../extractor/i18n';
import { toPascalCase } from '../extractor/NameTransformer';
import { Logger } from '../utils/Logger';

export class JsonToClassCommand {
    private generator: JsonClassGenerator;
    private logger: Logger;

    constructor() {
        this.generator = new JsonClassGenerator();
        this.logger = Logger.getInstance();
    }

    async executeInFolder(targetFolderUri: vscode.Uri): Promise<void> {
        const json = await this.getJsonInput();

        if (!json) {
            vscode.window.showWarningMessage(getLabels().jsonToClassNoClipboard);
            return;
        }

        try {
            JSON.parse(json);
        } catch {
            vscode.window.showErrorMessage(getLabels().jsonToClassInvalidJson);
            return;
        }

        const language = await this.selectLanguage();
        if (!language) { return; }

        let useLombok = false;
        if (language === 'java') {
            const lombokChoice = await this.selectLombok();
            if (lombokChoice === undefined) { return; }
            useLombok = lombokChoice;
        }

        const className = await this.inputClassName(json);
        if (!className) { return; }

        const derivedName = this.derivePackageName(targetFolderUri.fsPath);
        const packageName = await this.editPackageName(derivedName);
        if (!packageName) { return; }

        try {
            const code = this.generator.generate(json, className, packageName, language, useLombok);
            const didWrite = await this.writeToFile(code, className, packageName, language, targetFolderUri);
            if (didWrite) {
                vscode.window.showInformationMessage(getLabels().jsonToClassSuccess);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to generate DTO class: ${message}`);
        }
    }

    private derivePackageName(folderPath: string): string {
        const normalized = folderPath.replace(/\\/g, '/');

        const javaMatch = normalized.match(/\/java\/(.+)$/);
        if (javaMatch) {
            return javaMatch[1].replace(/\//g, '.');
        }

        const kotlinMatch = normalized.match(/\/kotlin\/(.+)$/);
        if (kotlinMatch) {
            return kotlinMatch[1].replace(/\//g, '.');
        }

        const segments = normalized.split('/').filter(s => s.length > 0);
        if (segments.length > 0) {
            return segments[segments.length - 1];
        }

        return '';
    }

    private async editPackageName(defaultName: string): Promise<string | undefined> {
        const labels = getLabels();
        return vscode.window.showInputBox({
            prompt: labels.jsonToClassPackageName,
            value: defaultName,
            validateInput: (input) => {
                if (!input || !input.trim()) { return 'Package name cannot be empty'; }
                if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/.test(input)) { return 'Invalid package name'; }
                return null;
            }
        });
    }

    private async writeToFile(code: string, className: string, _packageName: string, language: TargetLanguage, folderUri: vscode.Uri): Promise<boolean> {
        const extension = language === 'java' ? 'java' : 'kt';
        const fileName = `${className}.${extension}`;
        const fileUri = vscode.Uri.joinPath(folderUri, fileName);

        this.logger.info(`[JsonToClass] writing to: ${fileUri.fsPath}`);

        if (await this.fileExists(fileUri)) {
            const choice = await vscode.window.showWarningMessage(
                `${fileName} already exists. Overwrite it?`,
                { modal: true },
                'Overwrite'
            );
            if (choice !== 'Overwrite') {
                return false;
            }
        }

        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(code));

        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);
        return true;
    }

    private async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
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

    private async selectLombok(): Promise<boolean | undefined> {
        const labels = getLabels();
        const choice = await vscode.window.showQuickPick(
            [
                { label: labels.lombokUse, description: labels.lombokUseDesc, value: true },
                { label: labels.lombokSkip, description: labels.lombokSkipDesc, value: false }
            ],
            { placeHolder: labels.jsonToClassLombok }
        );
        return choice?.value;
    }

    private async inputClassName(json: string): Promise<string | undefined> {
        const labels = getLabels();
        const parsed = JSON.parse(json);
        let defaultName = 'Dto';

        const sanitizeKey = (rawKey: string | undefined): string => {
            if (!rawKey) { return 'Dto'; }
            const clean = toPascalCase(rawKey.replace(/[^a-zA-Z0-9_]/g, '_')).replace(/^[0-9]+/, '');
            return clean || 'Dto';
        };

        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
            defaultName = sanitizeKey(Object.keys(parsed[0])[0]);
        } else if (typeof parsed === 'object' && parsed !== null) {
            defaultName = sanitizeKey(Object.keys(parsed)[0]);
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
}
