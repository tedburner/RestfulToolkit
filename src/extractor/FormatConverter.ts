import { EndpointCopyInfo, DtoField } from '../models/types';

type NameTransformFn = (name: string) => string;

export class FormatConverter {
    toUrlParams(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return ''; }
        const names = info.parameters.map(p => nameTransform ? nameTransform(p.name) : p.name);
        return '?' + names.map(n => `${n}=`).join('&');
    }

    /**
     * 统一 JSON Body 格式：对 @RequestBody 参数尝试展开 DTO 字段，
     * 非 body 参数作为顶层键。展开失败时退化为快捷格式。
     */
    toJsonBody(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        const bodyParams = info.parameters.filter(p => p.source === 'body');
        const nonBodyParams = info.parameters.filter(p => p.source !== 'body');

        // 没有 body 参数时，退化为快捷格式
        if (bodyParams.length === 0) {
            return this.toJsonQuick(info, nameTransform);
        }

        // 只有一个 body 参数且有 DTO 字段时，尝试展开
        if (bodyParams.length === 1 && nonBodyParams.length === 0) {
            const bodyParam = bodyParams[0];
            const dtoFields = info.dtoFields.get(bodyParam.type);
            if (dtoFields && dtoFields.length > 0) {
                return this.buildExpandedJson(dtoFields, nameTransform);
            }
        }

        // 多个 body 参数或没有 DTO 字段，退化为快捷格式
        return this.toJsonQuick(info, nameTransform);
    }

    private buildExpandedJson(fields: DtoField[], nameTransform?: NameTransformFn): string {
        const entries = fields.map(f => {
            const name = nameTransform ? nameTransform(f.name) : f.name;
            return `"${name}": ""`;
        });
        return `{${entries.join(', ')}}`;
    }

    toJsonQuick(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return '{}'; }
        const entries = info.parameters.map(p => {
            const name = nameTransform ? nameTransform(p.name) : p.name;
            return `"${name}": ""`;
        });
        return `{${entries.join(', ')}}`;
    }

    toFormData(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return ''; }
        return info.parameters.map(p => {
            const name = nameTransform ? nameTransform(p.name) : p.name;
            return `${name}: `;
        }).join('\n');
    }

    toFormUrlencoded(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return ''; }
        const names = info.parameters.map(p => nameTransform ? nameTransform(p.name) : p.name);
        return names.map(n => `${n}=`).join('&');
    }
}
