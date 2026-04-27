import { EndpointCopyInfo, DtoField } from '../models/types';

type NameTransformFn = (name: string) => string;

export class FormatConverter {
    toUrlParams(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return ''; }
        const names = info.parameters.map(p => nameTransform ? nameTransform(p.name) : p.name);
        return '?' + names.map(n => `${n}=`).join('&');
    }

    toJsonBody(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        const bodyParams = info.parameters.filter(p => p.source === 'body');

        if (bodyParams.length === 0) {
            return this.toJsonQuick(info, nameTransform);
        }

        if (bodyParams.length === 1) {
            const bodyParam = bodyParams[0];
            const dtoFields = info.dtoFields.get(bodyParam.type);
            if (dtoFields && dtoFields.length > 0) {
                return this.buildExpandedJson(dtoFields, nameTransform);
            }
        }

        return this.toJsonQuick(info, nameTransform);
    }

    private buildExpandedJson(fields: DtoField[], nameTransform?: NameTransformFn): string {
        const entries = fields.map(f => this.buildFieldEntry(f, nameTransform));
        return `{${entries.join(', ')}}`;
    }

    private buildFieldEntry(field: DtoField, nameTransform?: NameTransformFn): string {
        const name = nameTransform ? nameTransform(field.name) : field.name;

        if (field.nested && field.nested.length > 0) {
            const nestedJson = this.buildExpandedJson(field.nested, nameTransform);
            return `"${name}": ${nestedJson}`;
        }

        return `"${name}": ""`;
    }

    /**
     * Form Data 格式：展开 source: 'form' 参数的 DTO 字段。
     */
    toFormData(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return ''; }
        const lines = this.expandFormParams(info, nameTransform);
        return lines.join('\n');
    }

    /**
     * x-www-form-urlencoded 格式：展开 source: 'form' 参数的 DTO 字段。
     */
    toFormUrlencoded(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return ''; }
        const entries = this.expandFormEntries(info, nameTransform);
        return entries.join('&');
    }

    /**
     * 展开表单参数为 form-data 行（name: value）。
     */
    private expandFormParams(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string[] {
        const result: string[] = [];
        for (const param of info.parameters) {
            if (param.source === 'form') {
                const dtoFields = info.dtoFields.get(param.type);
                if (dtoFields && dtoFields.length > 0) {
                    for (const f of dtoFields) {
                        const name = nameTransform ? nameTransform(f.name) : f.name;
                        result.push(`${name}: `);
                    }
                } else {
                    const name = nameTransform ? nameTransform(param.name) : param.name;
                    result.push(`${name}: `);
                }
            } else {
                const name = nameTransform ? nameTransform(param.name) : param.name;
                result.push(`${name}: `);
            }
        }
        return result;
    }

    /**
     * 展开表单参数为 urlencoded 条目（name=）。
     */
    private expandFormEntries(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string[] {
        const result: string[] = [];
        for (const param of info.parameters) {
            if (param.source === 'form') {
                const dtoFields = info.dtoFields.get(param.type);
                if (dtoFields && dtoFields.length > 0) {
                    for (const f of dtoFields) {
                        const name = nameTransform ? nameTransform(f.name) : f.name;
                        result.push(`${name}=`);
                    }
                } else {
                    const name = nameTransform ? nameTransform(param.name) : param.name;
                    result.push(`${name}=`);
                }
            } else {
                const name = nameTransform ? nameTransform(param.name) : param.name;
                result.push(`${name}=`);
            }
        }
        return result;
    }

    toJsonQuick(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return '{}'; }
        const entries = info.parameters.map(p => {
            const name = nameTransform ? nameTransform(p.name) : p.name;
            return `"${name}": ""`;
        });
        return `{${entries.join(', ')}}`;
    }
}
