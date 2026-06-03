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
    searchPlaceholder: string;
    searchNoEndpoints: string;
    searchOpenFileError: string;
    refreshIncrementalLabel: string;
    refreshIncrementalDesc: string;
    refreshIncrementalDetail: string;
    refreshFullLabel: string;
    refreshFullDesc: string;
    refreshFullDetail: string;
    refreshPlaceholder: string;
    refreshProgressFull: string;
    refreshProgressIncremental: string;
    refreshCompleteFull: string;
    refreshCompleteIncremental: string;
    scanProgress: string;
    scanNoFiles: string;
    scanCompleteIncremental: string;
    scanCompleteFull: string;
    statusBarProgress: string;
    lombokUse: string;
    lombokUseDesc: string;
    lombokSkip: string;
    lombokSkipDesc: string;
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
    jsonToClassLombok: '是否使用 Lombok',
    searchPlaceholder: '搜索 REST 端点 (路径、类名、方法名、HTTP 方法)',
    searchNoEndpoints: '未找到 REST 端点，请先扫描项目',
    searchOpenFileError: '无法打开文件: {0}',
    refreshIncrementalLabel: '$(sync) 增量刷新',
    refreshIncrementalDesc: '仅扫描修改过的文件（推荐）',
    refreshIncrementalDetail: '快速、高效，适合日常使用',
    refreshFullLabel: '$(refresh) 全量刷新',
    refreshFullDesc: '重新扫描所有文件',
    refreshFullDetail: '完整、彻底，适合配置变化或怀疑缓存错误时',
    refreshPlaceholder: '选择刷新模式',
    refreshProgressFull: 'RestfulToolkit: 全量刷新端点...',
    refreshProgressIncremental: 'RestfulToolkit: 增量刷新端点...',
    refreshCompleteFull: '全量刷新完成！共找到 {0} 个端点',
    refreshCompleteIncremental: '增量刷新完成！共找到 {0} 个端点（扫描 {1} 文件）',
    scanProgress: '正在扫描项目...',
    scanNoFiles: '扫描完成，未找到文件',
    scanCompleteIncremental: '扫描完成（增量模式），扫描 {0} 文件，跳过 {1} 未修改文件，共找到 {2} 个 REST 端点',
    scanCompleteFull: '扫描完成，共找到 {0} 个 REST 端点',
    statusBarProgress: 'RestfulToolkit: {0} ({1} 文件)',
    lombokUse: '✓ 使用',
    lombokUseDesc: '使用 Lombok @Data 注解',
    lombokSkip: '✗ 不使用',
    lombokSkipDesc: '自动生成 getter/setter 方法'
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
    jsonToClassLombok: 'Use Lombok',
    searchPlaceholder: 'Search REST endpoints (path, class, method, HTTP method)',
    searchNoEndpoints: 'No REST endpoints found. Please scan your project first.',
    searchOpenFileError: 'Failed to open file: {0}',
    refreshIncrementalLabel: '$(sync) Incremental Refresh',
    refreshIncrementalDesc: 'Scan only modified files (recommended)',
    refreshIncrementalDetail: 'Fast and efficient, suitable for daily use',
    refreshFullLabel: '$(refresh) Full Refresh',
    refreshFullDesc: 'Rescan all files',
    refreshFullDetail: 'Complete and thorough, for config changes or suspected cache issues',
    refreshPlaceholder: 'Select refresh mode',
    refreshProgressFull: 'RestfulToolkit: Full refresh endpoints...',
    refreshProgressIncremental: 'RestfulToolkit: Incremental refresh endpoints...',
    refreshCompleteFull: 'Full refresh complete! Found {0} endpoints',
    refreshCompleteIncremental: 'Incremental refresh complete! Found {0} endpoints (scanned {1} files)',
    scanProgress: 'Scanning project...',
    scanNoFiles: 'Scan complete, no files found',
    scanCompleteIncremental: 'Scan complete (incremental), scanned {0} files, skipped {1} unchanged, found {2} REST endpoints',
    scanCompleteFull: 'Scan complete, found {0} REST endpoints',
    statusBarProgress: 'RestfulToolkit: {0} ({1} files)',
    lombokUse: '✓ Use',
    lombokUseDesc: 'Use Lombok @Data annotation',
    lombokSkip: '✗ Skip',
    lombokSkipDesc: 'Auto-generate getter/setter methods'
};

export function getLabels(): I18nLabels {
    const locale = vscode.env.language;
    return locale.startsWith('zh') ? zhLabels : enLabels;
}
