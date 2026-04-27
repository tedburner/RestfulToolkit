import * as vscode from 'vscode';

export interface I18nLabels {
    title: string;
    urlParams: string;
    jsonQuick: string;
    jsonExpand: string;
    formData: string;
    formUrlencoded: string;
    nameFormat: string;
    camelCase: string;
    snakeCase: string;
    copied: string;
    noParams: string;
    copy: string;
    cancel: string;
    parseError: string;
    notOnMethod: string;
    notRestFile: string;
}

const zhLabels: I18nLabels = {
    title: '复制接口参数',
    urlParams: 'URL Params',
    jsonQuick: 'JSON Body (快捷)',
    jsonExpand: 'JSON Body (展开)',
    formData: 'Form Data',
    formUrlencoded: 'x-www-form-urlencoded',
    nameFormat: '命名格式',
    camelCase: '驼峰 (camelCase)',
    snakeCase: '蛇形 (snake_case)',
    copied: '✓ 已复制到剪贴板',
    noParams: '该方法没有可复制的参数',
    copy: '复制',
    cancel: '取消',
    parseError: '参数解析失败: {0}',
    notOnMethod: '请将光标放在接口方法上',
    notRestFile: '未检测到 REST 端点'
};

const enLabels: I18nLabels = {
    title: 'Copy Endpoint Parameters',
    urlParams: 'URL Params',
    jsonQuick: 'JSON Body (Quick)',
    jsonExpand: 'JSON Body (Expand)',
    formData: 'Form Data',
    formUrlencoded: 'x-www-form-urlencoded',
    nameFormat: 'Name Format',
    camelCase: 'camelCase',
    snakeCase: 'snake_case',
    copied: '✓ Copied to clipboard',
    noParams: 'No copyable parameters found',
    copy: 'Copy',
    cancel: 'Cancel',
    parseError: 'Failed to parse parameters: {0}',
    notOnMethod: 'Please place cursor on an endpoint method',
    notRestFile: 'No REST endpoint detected'
};

export function getLabels(): I18nLabels {
    const locale = vscode.env.language;
    return locale.startsWith('zh') ? zhLabels : enLabels;
}
