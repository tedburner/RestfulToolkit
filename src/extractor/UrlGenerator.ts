import { EndpointCopyInfo } from '../models/types';

/**
 * 完整 URL 生成器
 */
export class UrlGenerator {
    /**
     * 生成完整 URL
     * 路径参数保留 {placeholder} 形式，查询参数拼接在 URL 末尾
     */
    generate(copyInfo: EndpointCopyInfo, baseUrl: string): string {
        const path = copyInfo.path || '';
        const query = this.buildQueryString(copyInfo);
        return `${baseUrl}${path}${query}`;
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
