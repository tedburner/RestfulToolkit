import { EndpointParameter } from '../models/types';
import { Logger } from '../utils/Logger';

export class SpringParameterParser {
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * 从方法签名字符串中解析参数。
     * 接收从 "public/protected/private ... methodName(" 到 ")" 的文本。
     */
    parseMethodParameters(methodSignature: string): EndpointParameter[] {
        const params: EndpointParameter[] = [];

        const parenStart = methodSignature.indexOf('(');
        const parenEnd = methodSignature.lastIndexOf(')');
        if (parenStart === -1 || parenEnd === -1 || parenEnd <= parenStart) {
            return params;
        }

        const paramSection = methodSignature.substring(parenStart + 1, parenEnd).trim();
        if (!paramSection) { return params; }

        // 按逗号分割参数，需尊重泛型 <T> 的括号嵌套
        const paramStrings = this.splitParameters(paramSection);

        for (const paramStr of paramStrings) {
            const param = this.parseSingleParameter(paramStr.trim());
            if (param) {
                params.push(param);
            }
        }

        return params;
    }

    private splitParameters(paramSection: string): string[] {
        const params: string[] = [];
        let depth = 0;
        let parenDepth = 0;
        let current = '';

        for (const char of paramSection) {
            if (char === '<') { depth++; }
            else if (char === '>') { depth--; }
            else if (char === '(') { parenDepth++; }
            else if (char === ')') { parenDepth--; }
            else if (char === ',' && depth === 0 && parenDepth === 0) {
                params.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        if (current.trim()) { params.push(current.trim()); }

        return params;
    }

    private parseSingleParameter(paramStr: string): EndpointParameter | null {
        const paramAnnotation = this.extractParamAnnotation(paramStr);
        if (!paramAnnotation) { return null; }

        const { annotationName, explicitName, defaultValue, isRequired } = paramAnnotation;

        const afterAnnotation = paramStr.substring(paramAnnotation.endIndex).trim();
        const typeAndName = this.extractTypeAndName(afterAnnotation);
        if (!typeAndName) { return null; }

        const source = this.mapAnnotationToSource(annotationName);
        const name = explicitName || typeAndName.varName;
        // defaultValue 存在时，required 自动为 false
        const isRequiredFinal = isRequired !== null ? isRequired : (defaultValue !== undefined ? false : true);

        return {
            name,
            type: typeAndName.type,
            source,
            originalCaseName: typeAndName.varName,
            isRequired: isRequiredFinal,
            defaultValue
        };
    }

    private extractParamAnnotation(paramStr: string): {
        annotationName: string;
        explicitName: string | null;
        defaultValue: string | undefined;
        isRequired: boolean | null;
        endIndex: number;
    } | null {
        const annotations = [
            'RequestParam',
            'PathVariable',
            'RequestBody',
            'RequestPart',
            'ModelAttribute',
            'RequestHeader'
        ];

        for (const ann of annotations) {
            // 带括号的注解: @RequestParam("name")
            const pattern = new RegExp(`@${ann}\\s*\\(([^)]*)\\)`, 's');
            const match = paramStr.match(pattern);
            if (match) {
                const attrs = match[1];
                const explicitName = this.extractAnnotationNameValue(attrs);
                const defaultValue = this.extractAttribute(attrs, 'defaultValue');
                const requiredStr = this.extractAttribute(attrs, 'required');
                const isRequired = requiredStr !== null ? requiredStr === 'true' : null;

                return {
                    annotationName: ann,
                    explicitName,
                    defaultValue: defaultValue ? defaultValue.replace(/^"|"$/g, '') : undefined,
                    isRequired,
                    endIndex: match.index! + match[0].length
                };
            }

            // 裸注解无括号: @RequestBody
            const barePattern = new RegExp(`@${ann}\\s+(?=[A-Z])`);
            const bareMatch = paramStr.match(barePattern);
            if (bareMatch) {
                return {
                    annotationName: ann,
                    explicitName: null,
                    defaultValue: undefined,
                    isRequired: null,
                    endIndex: bareMatch.index! + bareMatch[0].length
                };
            }
        }

        return null;
    }

    private extractAnnotationNameValue(attrs: string): string | null {
        // value = "name" 或 value = 'name'
        const valueMatch = attrs.match(/(?:value\s*=\s*|^\s*)["']([^"']+)["']/);
        if (valueMatch) { return valueMatch[1]; }

        // 裸值: @RequestParam("name") → attrs = '"name"'
        const bareMatch = attrs.match(/^\s*["']([^"']+)["']/);
        if (bareMatch) { return bareMatch[1]; }

        return null;
    }

    private extractAttribute(attrs: string, attrName: string): string | null {
        const pattern = new RegExp(`${attrName}\\s*=\\s*([^,}\\)]+)`);
        const match = attrs.match(pattern);
        return match ? match[1].trim() : null;
    }

    private extractTypeAndName(afterAnnotation: string): { type: string; varName: string } | null {
        // 匹配: "String keyword"、"Long id"、"UserDto userDto"、"MultipartFile file"
        const match = afterAnnotation.match(/([\w<>]+)\s+(\w+)/);
        if (match) {
            return { type: match[1], varName: match[2] };
        }
        // 只有类型，无变量名（罕见）
        const typeOnly = afterAnnotation.match(/^([\w<>]+)/);
        if (typeOnly) {
            return { type: typeOnly[1], varName: typeOnly[1].toLowerCase() };
        }
        return null;
    }

    private mapAnnotationToSource(annotationName: string): EndpointParameter['source'] {
        switch (annotationName) {
            case 'PathVariable': return 'path';
            case 'RequestParam': return 'query';
            case 'RequestBody': return 'body';
            case 'RequestPart': return 'form';
            case 'ModelAttribute': return 'form';
            case 'RequestHeader': return 'header';
            default: return 'query';
        }
    }
}
