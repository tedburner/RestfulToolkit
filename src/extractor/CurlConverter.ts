import { EndpointCopyInfo, DtoField } from '../models/types';

/**
 * cURL 命令生成器
 */
export class CurlConverter {
    generate(copyInfo: EndpointCopyInfo, baseUrl: string): string {
        const { httpMethod } = copyInfo;
        const url = this.buildUrl(copyInfo, baseUrl);
        const parts: string[] = [`curl -X ${httpMethod} '${url}'`];

        // Headers
        const headers = this.buildHeaders(copyInfo);
        for (const header of headers) {
            parts.push(`  -H '${header}'`);
        }

        // Body
        const body = this.buildBody(copyInfo);
        if (body) {
            parts.push(`  -d '${body}'`);
        }

        return parts.join(' \\\n');
    }

    /**
     * 构建 URL（GET/DELETE 拼接查询参数）
     */
    private buildUrl(copyInfo: EndpointCopyInfo, baseUrl: string): string {
        const { httpMethod, path, parameters } = copyInfo;
        let url = `${baseUrl}${path}`;

        // GET/DELETE 拼接查询参数
        if (httpMethod === 'GET' || httpMethod === 'DELETE') {
            const queryParams = parameters.filter(p => p.source === 'query');
            if (queryParams.length > 0) {
                const query = queryParams.map(p => `${encodeURIComponent(p.name)}=`).join('&');
                url += '?' + query;
            }
        }

        return url;
    }

    /**
     * 构建 Headers
     */
    private buildHeaders(copyInfo: EndpointCopyInfo): string[] {
        const headers: string[] = [];

        // 根据内容类型添加 Content-Type
        switch (copyInfo.contentType) {
            case 'json':
                headers.push('Content-Type: application/json');
                break;
            case 'form-data':
                headers.push('Content-Type: multipart/form-data');
                break;
            case 'x-www-form-urlencoded':
                headers.push('Content-Type: application/x-www-form-urlencoded');
                break;
        }

        // 请求头参数
        const headerParams = copyInfo.parameters.filter(p => p.source === 'header');
        for (const param of headerParams) {
            const value = param.defaultValue || '';
            headers.push(`${param.name}: ${value}`);
        }

        return headers;
    }

    /**
     * 构建 Body
     */
    private buildBody(copyInfo: EndpointCopyInfo): string | null {
        const { httpMethod, contentType, parameters } = copyInfo;

        // 只有 POST/PUT/PATCH 有 Body
        if (!['POST', 'PUT', 'PATCH'].includes(httpMethod)) { return null; }

        if (contentType === 'json') {
            return this.buildJsonBody(parameters, copyInfo);
        }

        if (contentType === 'form-data') {
            return this.buildFormDataBody(parameters);
        }

        if (contentType === 'x-www-form-urlencoded') {
            return this.buildFormUrlencodedBody(parameters);
        }

        return null;
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

        // 降级：简单 JSON
        const entries = bodyParams.map(p => `"${p.name}": ""`);
        return `{${entries.join(', ')}}`;
    }

    private buildExpandedJson(fields: DtoField[]): string {
        const entries = fields.map(f => this.buildFieldEntry(f));
        return `{${entries.join(', ')}}`;
    }

    private buildFieldEntry(field: DtoField): string {
        if (field.nested && field.nested.length > 0) {
            const nestedJson = this.buildExpandedJson(field.nested);
            return `"${field.name}": ${nestedJson}`;
        }
        return `"${field.name}": ""`;
    }

    private buildFormDataBody(parameters: EndpointCopyInfo['parameters']): string | null {
        const fields = this.flattenFormFields(parameters);
        if (fields.length === 0) { return null; }
        return fields.map(f => `${f}=`).join('&');
    }

    private buildFormUrlencodedBody(parameters: EndpointCopyInfo['parameters']): string | null {
        const fields = this.flattenFormFields(parameters);
        if (fields.length === 0) { return null; }
        return fields.map(f => `${f}=`).join('&');
    }

    private flattenFormFields(parameters: EndpointCopyInfo['parameters']): string[] {
        const fields: string[] = [];
        for (const param of parameters) {
            if (param.source === 'form') {
                // Form 参数的 DTO 字段展开
                // 注意：实际展开需要 copyInfo.dtoFields，这里简化处理
                fields.push(param.name);
            } else if (param.source !== 'header' && param.source !== 'path') {
                fields.push(param.name);
            }
        }
        return fields;
    }
}
