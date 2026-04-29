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
    curlCopyError: '无法生成 cURL 命令'
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
    curlCopyError: 'Failed to generate cURL command'
};

export function getLabels(): I18nLabels {
    const locale = vscode.env.language;
    return locale.startsWith('zh') ? zhLabels : enLabels;
}
