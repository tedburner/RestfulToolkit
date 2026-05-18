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

    // Explorer folder context menu entry
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

        const className = await this.inputClassName(json);
        if (!className) { return; }

        // Derive package name from folder path
        const derivedName = this.derivePackageName(targetFolderUri.fsPath);
        // Allow user to edit the derived package name
        const packageName = await this.editPackageName(derivedName);
        if (!packageName) { return; }

        try {
            const code = this.generator.generate(json, className, packageName, language);
            await this.writeToFile(code, className, packageName, language, targetFolderUri);
            vscode.window.showInformationMessage(getLabels().jsonToClassSuccess);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to generate DTO class: ${message}`);
        }
    }

    // Derive Java package name from folder path
    // Looks for /java/ or /kotlin/ in the path and extracts the package portion
    private derivePackageName(folderPath: string): string {
        // Normalize to forward slashes for matching
        const normalized = folderPath.replace(/\\/g, '/');

        // Match: .../java/com/example/dto  or  .../kotlin/com/example/dto
        const javaMatch = normalized.match(/\/java\/(.+)$/);
        if (javaMatch) {
            return javaMatch[1].replace(/\//g, '.');
        }

        const kotlinMatch = normalized.match(/\/kotlin\/(.+)$/);
        if (kotlinMatch) {
            return kotlinMatch[1].replace(/\//g, '.');
        }

        // Fallback: use the last path segment
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

    // Write file directly to target folder (no save dialog)
    private async writeToFile(code: string, className: string, _packageName: string, language: TargetLanguage, folderUri: vscode.Uri): Promise<void> {
        const extension = language === 'java' ? 'java' : 'kt';
        const fileName = `${className}.${extension}`;
        const fileUri = vscode.Uri.joinPath(folderUri, fileName);

        console.log(`[JsonToClass] writing to: ${fileUri.fsPath}`);

        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(code));

        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);
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

}
