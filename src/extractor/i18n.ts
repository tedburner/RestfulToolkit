import * as vscode from 'vscode';

export interface I18nLabels {
    title: string;
    urlParams: string;
    jsonBody: string;
    formData: string;
    formUrlencoded: string;
    nameFormat: string;
    copied: string;
    noParams: string;
    copy: string;
    cancel: string;
    parseError: string;
    notOnMethod: string;
    notRestFile: string;
    urlCopied: string;
    curlCopied: string;
    urlCopyError: string;
    curlCopyError: string;
    jsonToClassTitle: string;
    jsonToClassLanguage: string;
    jsonToClassClassName: string;
    jsonToClassPackageName: string;
    jsonToClassJava: string;
    jsonToClassKotlin: string;
    jsonToClassNoClipboard: string;
    jsonToClassInvalidJson: string;
    jsonToClassSuccess: string;
    jsonToClassLombok: string;
}

const zhLabels: I18nLabels = {
    title: '复制接口参数',
    urlParams: 'URL Params',
    jsonBody: 'JSON Body',
    formData: 'Form Data',
    formUrlencoded: 'x-www-form-urlencoded',
    nameFormat: '命名格式',
    copied: '✓ 已复制到剪贴板',
    noParams: '该方法没有可复制的参数',
    copy: '复制',
    cancel: '取消',
    parseError: '参数解析失败: {0}',
    notOnMethod: '请将光标放在接口方法上',
    notRestFile: '未检测到 REST 端点',
    urlCopied: '✓ URL 已复制到剪贴板',
    curlCopied: '✓ cURL 命令已复制到剪贴板',
    urlCopyError: '无法生成 URL',
    curlCopyError: '无法生成 cURL 命令',
    jsonToClassTitle: 'JSON 转 DTO 类',
    jsonToClassLanguage: '选择目标语言',
    jsonToClassClassName: '类名',
    jsonToClassPackageName: '包名',
    jsonToClassJava: 'Java',
    jsonToClassKotlin: 'Kotlin',
    jsonToClassNoClipboard: '请先复制 JSON 到剪贴板，或在编辑器中选中 JSON 内容',
    jsonToClassInvalidJson: '内容不是有效的 JSON 格式',
    jsonToClassSuccess: '✓ DTO 类文件已生成',
    jsonToClassLombok: '是否使用 Lombok'
};

const enLabels: I18nLabels = {
    title: 'Copy Endpoint Parameters',
    urlParams: 'URL Params',
    jsonBody: 'JSON Body',
    formData: 'Form Data',
    formUrlencoded: 'x-www-form-urlencoded',
    nameFormat: 'Name Format',
    copied: '✓ Copied to clipboard',
    noParams: 'No copyable parameters found',
    copy: 'Copy',
    cancel: 'Cancel',
    parseError: 'Failed to parse parameters: {0}',
    notOnMethod: 'Please place cursor on an endpoint method',
    notRestFile: 'No REST endpoint detected',
    urlCopied: '✓ URL copied to clipboard',
    curlCopied: '✓ cURL command copied to clipboard',
    urlCopyError: 'Failed to generate URL',
    curlCopyError: 'Failed to generate cURL command',
    jsonToClassTitle: 'JSON to DTO Class',
    jsonToClassLanguage: 'Select target language',
    jsonToClassClassName: 'Class name',
    jsonToClassPackageName: 'Package name',
    jsonToClassJava: 'Java',
    jsonToClassKotlin: 'Kotlin',
    jsonToClassNoClipboard: 'Please copy JSON to clipboard or select JSON in editor first',
    jsonToClassInvalidJson: 'Content is not valid JSON format',
    jsonToClassSuccess: '✓ DTO class file generated',
    jsonToClassLombok: 'Use Lombok'
};

export function getLabels(): I18nLabels {
    const locale = vscode.env.language;
    return locale.startsWith('zh') ? zhLabels : enLabels;
}
