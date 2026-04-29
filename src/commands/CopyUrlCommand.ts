import * as vscode from 'vscode';
import { ParameterExtractor } from '../extractor/ParameterExtractor';
import { UrlGenerator } from '../extractor/UrlGenerator';
import { ConfigManager } from '../config/ConfigManager';
import { getLabels } from '../extractor/i18n';

export class CopyUrlCommand {
    private extractor: ParameterExtractor;
    private generator: UrlGenerator;

    constructor() {
        this.extractor = new ParameterExtractor();
        this.generator = new UrlGenerator();
    }

    async execute(): Promise<void> {
        const labels = getLabels();
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showWarningMessage(labels.notOnMethod);
            return;
        }

        const { document, selection } = editor;
        const position = selection.active;

        try {
            const copyInfo = await this.extractor.extract(document, position);

            if (!copyInfo) {
                vscode.window.showWarningMessage(labels.notRestFile);
                return;
            }

            const baseUrl = ConfigManager.getInstance().getBaseUrl();
            const url = this.generator.generate(copyInfo, baseUrl);

            await vscode.env.clipboard.writeText(url);
            vscode.window.showInformationMessage(labels.urlCopied);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(labels.urlCopyError + `: ${message}`);
        }
    }
}
