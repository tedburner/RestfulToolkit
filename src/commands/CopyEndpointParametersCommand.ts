import * as vscode from 'vscode';
import { ParameterExtractor } from '../extractor/ParameterExtractor';
import { FormatConverter } from '../extractor/FormatConverter';
import { toSnakeCase } from '../extractor/NameTransformer';
import { getLabels, I18nLabels } from '../extractor/i18n';
import { EndpointCopyInfo } from '../models/types';

interface FormatOption {
    label: string;
    value: 'url-params' | 'json-body' | 'form-data' | 'x-www-form-urlencoded';
    icon: string;
}

export class CopyEndpointParametersCommand {
    private extractor: ParameterExtractor;
    private converter: FormatConverter;

    constructor() {
        this.extractor = new ParameterExtractor();
        this.converter = new FormatConverter();
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

            if (!copyInfo || copyInfo.parameters.length === 0) {
                vscode.window.showWarningMessage(labels.noParams);
                return;
            }

            const format = await this.showFormatPicker(copyInfo, labels);
            if (!format) { return; }

            const nameTransform = this.autoDetectNameTransform(copyInfo);

            let output: string;
            switch (format) {
                case 'url-params':
                    output = this.converter.toUrlParams(copyInfo, nameTransform);
                    break;
                case 'json-body':
                    output = this.converter.toJsonBody(copyInfo, nameTransform);
                    break;
                case 'form-data':
                    output = this.converter.toFormData(copyInfo, nameTransform);
                    break;
                case 'x-www-form-urlencoded':
                    output = this.converter.toFormUrlencoded(copyInfo, nameTransform);
                    break;
                default:
                    output = '';
            }

            await vscode.env.clipboard.writeText(output);
            vscode.window.showInformationMessage(labels.copied);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(labels.parseError.replace('{0}', message));
        }
    }

    private async showFormatPicker(copyInfo: EndpointCopyInfo, labels: I18nLabels): Promise<string | null> {
        const defaultFormat = this.autoDetectFormat(copyInfo);

        const formats: FormatOption[] = [
            { label: `${labels.urlParams}`, value: 'url-params', icon: '$(link)' },
            { label: `${labels.jsonBody}`, value: 'json-body', icon: '$(json)' },
            { label: `${labels.formData}`, value: 'form-data', icon: '$(file-media)' },
            { label: `${labels.formUrlencoded}`, value: 'x-www-form-urlencoded', icon: '$(file-text)' },
        ];

        const items = formats.map((f, i) => ({
            label: f.label,
            description: i === defaultFormat ? `✓ ${labels.nameFormat}` : undefined,
            value: f.value
        }));

        const pick = await vscode.window.showQuickPick(items, {
            placeHolder: labels.title,
            matchOnDescription: true
        });

        return pick?.value || null;
    }

    /**
     * 根据参数名和 DTO 字段名自动判断是否需要转 snake_case。
     * 如果大部分字段名中包含下划线，返回 snake_case 转换函数。
     */
    private autoDetectNameTransform(copyInfo: EndpointCopyInfo): ((n: string) => string) | undefined {
        const allNames: string[] = [];

        // 收集参数名
        allNames.push(...copyInfo.parameters.map(p => p.name));

        // 收集 DTO 字段名
        for (const fields of copyInfo.dtoFields.values()) {
            allNames.push(...fields.map(f => f.name));
        }

        if (allNames.length === 0) { return undefined; }

        // 如果包含下划线的名称超过 50%，判定为 snake_case
        const snakeCount = allNames.filter(n => n.includes('_')).length;
        return snakeCount / allNames.length > 0.5 ? toSnakeCase : undefined;
    }

    private autoDetectFormat(copyInfo: EndpointCopyInfo): number {
        const { httpMethod, contentType, parameters } = copyInfo;
        const hasBody = parameters.some(p => p.source === 'body');
        const hasForm = parameters.some(p => p.source === 'form');

        if (httpMethod === 'GET' || httpMethod === 'DELETE') { return 0; }
        if (hasBody) { return 1; }
        if (hasForm) { return 2; }
        if (contentType === 'form-data') { return 2; }
        if (contentType === 'x-www-form-urlencoded') { return 3; }
        if (['POST', 'PUT', 'PATCH'].includes(httpMethod)) { return 1; }
        return -1;
    }
}
