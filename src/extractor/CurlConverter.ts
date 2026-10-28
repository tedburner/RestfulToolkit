import { EndpointCopyInfo, DtoField } from '../models/types';

/**
 * cURL 命令生成器
 *
 * 按参数来源组装请求：查询参数通常拼入 URL；Spring 表单请求中的 @RequestParam
 * 默认按表单字段处理（源码不能区分它来自 URL 还是表单）；
 * 正文按内容类型分别输出 JSON（-d）、urlencoded（-d）或 multipart（-F，
 * 由 cURL 生成 boundary，不手写 Content-Type 头）。
 */
export class CurlConverter {
    generate(copyInfo: EndpointCopyInfo, baseUrl: string): string {
        const { httpMethod } = copyInfo;
        const url = this.buildUrl(copyInfo, baseUrl);
        const parts: string[] = [`curl -X ${httpMethod} '${this.escapeShellSingleQuote(url)}'`];

        // Headers
        const headers = this.buildHeaders(copyInfo);
        for (const header of headers) {
            parts.push(`  -H '${this.escapeShellSingleQuote(header)}'`);
        }

        // Body
        const bodyParts = this.buildBodyParts(copyInfo);
        for (const bodyPart of bodyParts) {
            parts.push(bodyPart);
        }

        return parts.join(' \\\n');
    }

    /**
     * 对单引号值进行 Shell 转义，防止命令注入
     */
    private escapeShellSingleQuote(value: string): string {
        return value.replace(/'/g, "'\\''");
    }

    /**
     * 构建 URL：查询参数对所有 HTTP 方法拼接到 URL，路径参数保留 {placeholder}
     */
    private buildUrl(copyInfo: EndpointCopyInfo, baseUrl: string): string {
        let url = `${baseUrl}${copyInfo.path}`;

        const queryParams = copyInfo.parameters.filter(p => p.source === 'query' && !this.isSpringFormRequest(copyInfo));
        if (queryParams.length > 0) {
            const query = queryParams.map(p => `${encodeURIComponent(p.name)}=`).join('&');
            url += '?' + query;
        }

        return url;
    }

    /**
     * 构建 Headers
     */
    private buildHeaders(copyInfo: EndpointCopyInfo): string[] {
        const headers: string[] = [];
        const headerParams = copyInfo.parameters.filter(p => p.source === 'header');

        // 检查请求参数中是否已指定 Content-Type 头
        const hasContentType = headerParams.some(p => p.name.toLowerCase() === 'content-type');

        // multipart 由 -F 生成带 boundary 的 Content-Type，手写头部反而破坏分段结构
        if (!hasContentType && copyInfo.contentType !== 'form-data') {
            switch (copyInfo.contentType) {
                case 'json':
                    headers.push('Content-Type: application/json');
                    break;
                case 'x-www-form-urlencoded':
                    headers.push('Content-Type: application/x-www-form-urlencoded');
                    break;
            }
        }

        // 请求头参数
        for (const param of headerParams) {
            const value = param.defaultValue || '';
            headers.push(`${param.name}: ${value}`);
        }

        return headers;
    }

    /**
     * 按内容类型构建正文参数行；无正文时返回空数组。
     */
    private buildBodyParts(copyInfo: EndpointCopyInfo): string[] {
        const { httpMethod, contentType, parameters } = copyInfo;

        // 只有 POST/PUT/PATCH 有 Body
        if (!['POST', 'PUT', 'PATCH'].includes(httpMethod)) { return []; }

        if (contentType === 'form-data') {
            return this.buildMultipartParts(parameters, this.isSpringFormRequest(copyInfo));
        }

        if (contentType === 'x-www-form-urlencoded') {
            return this.buildUrlencodedPart(parameters, this.isSpringFormRequest(copyInfo));
        }

        if (contentType === 'json') {
            const body = this.buildJsonBody(parameters, copyInfo);
            return body ? [`  -d '${this.escapeShellSingleQuote(body)}'`] : [];
        }

        return [];
    }

    /**
     * multipart 表单：文件参数输出 `-F 'name=@file'` 占位，其余输出 `-F 'name='`。
     */
    private isSpringFormRequest(copyInfo: EndpointCopyInfo): boolean {
        return copyInfo.framework === 'Spring'
            && ['POST', 'PUT', 'PATCH'].includes(copyInfo.httpMethod)
            && (copyInfo.contentType === 'form-data' || copyInfo.contentType === 'x-www-form-urlencoded');
    }

    private buildMultipartParts(parameters: EndpointCopyInfo['parameters'], springForm: boolean): string[] {
        const parts: string[] = [];
        for (const param of parameters) {
            if (param.source !== 'form' && !(springForm && param.source === 'query')) { continue; }
            if (this.isFileUploadType(param.type)) {
                parts.push(`  -F '${this.escapeShellSingleQuote(param.name)}=@/path/to/file'`);
            } else {
                parts.push(`  -F '${this.escapeShellSingleQuote(param.name)}='`);
            }
        }
        return parts;
    }

    private isFileUploadType(type: string): boolean {
        return type === 'File' || /MultipartFile|InputStreamResource|Resource/.test(type);
    }

    /**
     * urlencoded 正文使用表单字段和 Spring 表单请求的 @RequestParam。
     */
    private buildUrlencodedPart(parameters: EndpointCopyInfo['parameters'], springForm: boolean): string[] {
        const fields = parameters.filter(p => p.source === 'form' || (springForm && p.source === 'query'));
        if (fields.length === 0) { return []; }
        const body = fields.map(p => `${encodeURIComponent(p.name)}=`).join('&');
        return [`  -d '${this.escapeShellSingleQuote(body)}'`];
    }

    private buildJsonBody(parameters: EndpointCopyInfo['parameters'], copyInfo: EndpointCopyInfo): string | null {
        const bodyParams = parameters.filter(p => p.source === 'body');
        if (bodyParams.length === 0) { return null; }

        if (bodyParams.length === 1) {
            const bodyParam = bodyParams[0];
            const dtoFields = copyInfo.dtoFields.get(bodyParam.type);
            if (dtoFields && dtoFields.length > 0) {
                return this.buildExpandedJson(dtoFields);
            }
        }

        // 降级：简单 JSON，使用 JSON.stringify 保证 key/value 安全转义
        const entries = bodyParams.map(p => `${JSON.stringify(p.name)}: ""`);
        return `{${entries.join(', ')}}`;
    }

    private buildExpandedJson(fields: DtoField[]): string {
        const entries = fields.map(f => this.buildFieldEntry(f));
        return `{${entries.join(', ')}}`;
    }

    private buildFieldEntry(field: DtoField): string {
        if (field.nested && field.nested.length > 0) {
            const nestedJson = this.buildExpandedJson(field.nested);
            return `${JSON.stringify(field.name)}: ${nestedJson}`;
        }
        return `${JSON.stringify(field.name)}: ""`;
    }
}
