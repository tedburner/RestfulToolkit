import * as vscode from 'vscode';
import { ParameterExtractor } from '../extractor/ParameterExtractor';
import { FormatConverter } from '../extractor/FormatConverter';
import { toSnakeCase } from '../extractor/NameTransformer';
import { getLabels, I18nLabels } from '../extractor/i18n';
import { EndpointCopyInfo } from '../models/types';

interface FormatOption {
    label: string;
    value: 'url-params' | 'json-quick' | 'json-expand' | 'form-data' | 'x-www-form-urlencoded';
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

            const result = await this.showFormatPicker(copyInfo, labels);
            if (!result) { return; }

            const { format, nameFormat } = result;
            const nameTransform = nameFormat === 'snake_case' ? toSnakeCase : undefined;

            let output: string;
            switch (format) {
                case 'url-params':
                    output = this.converter.toUrlParams(copyInfo, nameTransform);
                    break;
                case 'json-quick':
                    output = this.converter.toJsonQuick(copyInfo, nameTransform);
                    break;
                case 'json-expand':
                    output = this.converter.toJsonExpand(copyInfo, nameTransform);
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

    private async showFormatPicker(copyInfo: EndpointCopyInfo, labels: I18nLabels): Promise<{
        format: string;
        nameFormat: 'camelCase' | 'snake_case';
    } | null> {
        const defaultFormat = this.autoDetectFormat(copyInfo);

        const formats: FormatOption[] = [
            { label: `${labels.urlParams}`, value: 'url-params', icon: '$(link)' },
            { label: `${labels.jsonQuick}`, value: 'json-quick', icon: '$(json)' },
            { label: `${labels.jsonExpand}`, value: 'json-expand', icon: '$(json)' },
            { label: `${labels.formData}`, value: 'form-data', icon: '$(file-media)' },
            { label: `${labels.formUrlencoded}`, value: 'x-www-form-urlencoded', icon: '$(file-text)' },
        ];

        const items = formats.map((f, i) => ({
            label: f.label,
            description: i === defaultFormat ? `✓ ${labels.nameFormat}` : undefined,
            value: f.value
        }));

        const formatPick = await vscode.window.showQuickPick(items, {
            placeHolder: labels.title,
            matchOnDescription: true
        });

        if (!formatPick) { return null; }

        const nameFormatItems = [
            { label: labels.camelCase, value: 'camelCase' as const },
            { label: labels.snakeCase, value: 'snake_case' as const }
        ];

        const nameFormatPick = await vscode.window.showQuickPick(nameFormatItems, {
            placeHolder: labels.nameFormat
        });

        return {
            format: formatPick.value,
            nameFormat: nameFormatPick?.value || 'camelCase'
        };
    }

    private autoDetectFormat(copyInfo: EndpointCopyInfo): number {
        const { httpMethod, contentType, parameters } = copyInfo;
        const hasBody = parameters.some(p => p.source === 'body');

        if (httpMethod === 'GET' || httpMethod === 'DELETE') { return 0; }
        if (hasBody) { return 1; }
        if (contentType === 'form-data') { return 3; }
        if (contentType === 'x-www-form-urlencoded') { return 4; }
        if (['POST', 'PUT', 'PATCH'].includes(httpMethod)) { return 1; }
        return -1;
    }
}
