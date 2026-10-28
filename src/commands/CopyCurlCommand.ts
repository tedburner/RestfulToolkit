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
            // cURL 只在 JSON 正文使用 DTO 字段；其余内容类型跳过 DTO 文件 I/O，
            // Base URL 解析与必要的 DTO 展开并行执行
            const copyInfo = await this.extractor.extract(document, position, { expandDto: false });

            if (!copyInfo) {
                vscode.window.showWarningMessage(labels.notRestFile);
                return;
            }

            const [baseUrl] = await Promise.all([
                ConfigManager.getInstance().getBaseUrlAsync(document.uri),
                copyInfo.contentType === 'json'
                    ? this.extractor.expandDtoFields(copyInfo, document)
                    : Promise.resolve()
            ]);
            const curl = this.converter.generate(copyInfo, baseUrl);

            await vscode.env.clipboard.writeText(curl);
            vscode.window.showInformationMessage(labels.curlCopied);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(labels.curlCopyError + `: ${message}`);
        }
    }
}
