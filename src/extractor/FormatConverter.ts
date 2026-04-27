import { EndpointCopyInfo } from '../models/types';

type NameTransformFn = (name: string) => string;

export class FormatConverter {
    toUrlParams(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return ''; }
        const names = info.parameters.map(p => nameTransform ? nameTransform(p.name) : p.name);
        return '?' + names.map(n => `${n}=`).join('&');
    }

    toJsonQuick(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        if (info.parameters.length === 0) { return '{}'; }
        const entries = info.parameters.map(p => {
            const name = nameTransform ? nameTransform(p.name) : p.name;
            return `"${name}": ""`;
        });
        return `{${entries.join(', ')}}`;
    }

    toJsonExpand(info: EndpointCopyInfo, nameTransform?: NameTransformFn): string {
        // 默认退化为快捷格式；展开需跨文件解析 DTO 字段（后续增强）
        return this.toJsonQuick(info, nameTransform);
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
