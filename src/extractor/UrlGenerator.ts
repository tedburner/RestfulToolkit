import { EndpointCopyInfo } from '../models/types';

/**
 * 规范化拼接 Base URL 与端点路径，消除连接处的双斜杠或缺失斜杠。
 */
export function joinBaseAndPath(baseUrl: string, endpointPath: string): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    if (!endpointPath) {
        return cleanBase;
    }
    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    return `${cleanBase}${cleanPath}`;
}

/**
 * 完整 URL 生成器
 */
export class UrlGenerator {
    /**
     * 生成完整 URL
     * 路径参数保留 {placeholder} 形式，查询参数拼接在 URL 末尾
     */
    generate(copyInfo: EndpointCopyInfo, baseUrl: string): string {
        const fullUrl = joinBaseAndPath(baseUrl, copyInfo.path || '');
        const query = this.buildQueryString(copyInfo);
        return `${fullUrl}${query}`;
    }

    /**
     * 构建查询字符串（仅 source 为 query 的参数）
     */
    private buildQueryString(copyInfo: EndpointCopyInfo): string {
        const queryParams = copyInfo.parameters.filter(p => p.source === 'query');
        if (queryParams.length === 0) { return ''; }

        const pairs = queryParams.map(p => `${encodeURIComponent(p.name)}=`);
        return '?' + pairs.join('&');
    }
}
