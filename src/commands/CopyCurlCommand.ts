import * as vscode from 'vscode';
import { ParameterExtractor } from '../extractor/ParameterExtractor';
import { CurlConverter } from '../extractor/CurlConverter';
import { ConfigManager } from '../config/ConfigManager';
import { getLabels } from '../extractor/i18n';

export class CopyCurlCommand {
    private extractor: ParameterExtractor;
    private converter: CurlConverter;

    constructor() {
        this.extractor = new ParameterExtractor();
        this.converter = new CurlConverter();
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
            const curl = this.converter.generate(copyInfo, baseUrl);

            await vscode.env.clipboard.writeText(curl);
            vscode.window.showInformationMessage(labels.curlCopied);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(labels.curlCopyError + `: ${message}`);
        }
    }
}
