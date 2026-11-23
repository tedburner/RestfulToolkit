import { EndpointParameter } from '../models/types';
import { Logger } from '../utils/Logger';

export interface ParsedParamAnnotation {
    fullName: string;
    simpleName: string;
    attrs: string | null;
}

export class SpringParameterParser {
    private static readonly supportedAnnotations = new Set([
        'RequestParam',
        'PathVariable',
        'RequestBody',
        'RequestPart',
        'ModelAttribute',
        'RequestHeader'
    ]);

    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * 从方法签名字符串中解析参数。
     * 接收从 "methodName(" 到 ")" 的文本。
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

        const paramStrings = SpringParameterParser.splitParameters(paramSection);

        for (const paramStr of paramStrings) {
            const param = this.parseSingleParameter(paramStr.trim());
            if (param) {
                params.push(param);
            }
        }

        return params;
    }

    static splitParameters(paramSection: string): string[] {
        const params: string[] = [];
        let angleDepth = 0;
        let parenDepth = 0;
        let braceDepth = 0;
        let inQuote: string | null = null;
        let current = '';

        for (let i = 0; i < paramSection.length; i++) {
            const char = paramSection[i];
            if (inQuote) {
                current += char;
                if (char === '\\' && i + 1 < paramSection.length) {
                    current += paramSection[++i];
                } else if (char === inQuote) {
                    inQuote = null;
                }
                continue;
            }
            if (char === '"' || char === "'") {
                inQuote = char;
                current += char;
                continue;
            }
            if (char === '<') { angleDepth++; }
            else if (char === '>' && angleDepth > 0) { angleDepth--; }
            else if (char === '(') { parenDepth++; }
            else if (char === ')' && parenDepth > 0) { parenDepth--; }
            else if (char === '{') { braceDepth++; }
            else if (char === '}' && braceDepth > 0) { braceDepth--; }
            else if (char === ',' && angleDepth === 0 && parenDepth === 0 && braceDepth === 0) {
                if (current.trim()) {
                    params.push(current.trim());
                }
                current = '';
                continue;
            }
            current += char;
        }
        if (current.trim()) { params.push(current.trim()); }

        return params;
    }

    /**
     * 剥离参数声明前的所有注解与前置修饰符，返回注解列表及剩余的类型/变量名文本。
     */
    static extractLeadingAnnotations(paramStr: string): {
        annotations: ParsedParamAnnotation[];
        remainder: string;
    } {
        const annotations: ParsedParamAnnotation[] = [];
        let idx = 0;

        while (idx < paramStr.length) {
            while (idx < paramStr.length && /\s/.test(paramStr[idx])) {
                idx++;
            }
            if (idx >= paramStr.length) {
                break;
            }

            if (paramStr[idx] === '@') {
                const parsed = this.readSingleAnnotation(paramStr, idx);
                if (!parsed) {
                    break;
                }
                annotations.push(parsed.annotation);
                idx = parsed.nextIndex;
                continue;
            }

            const modifierMatch = paramStr.slice(idx).match(/^(?:final|vararg|crossinline|noinline)\b\s*/);
            if (modifierMatch) {
                idx += modifierMatch[0].length;
                continue;
            }

            break;
        }

        return {
            annotations,
            remainder: paramStr.slice(idx).trim()
        };
    }

    private static readSingleAnnotation(text: string, start: number): {
        annotation: ParsedParamAnnotation;
        nextIndex: number;
    } | null {
        let cursor = start + 1;
        while (cursor < text.length && /[\w.:$]/.test(text[cursor])) {
            cursor++;
        }
        const fullName = text.slice(start + 1, cursor);
        if (!fullName) {
            return null;
        }
        const simpleName = fullName.split(/[.:]/).pop() || fullName;

        let afterName = cursor;
        while (afterName < text.length && /\s/.test(text[afterName])) {
            afterName++;
        }

        if (text[afterName] !== '(') {
            return {
                annotation: { fullName, simpleName, attrs: null },
                nextIndex: cursor
            };
        }

        let depth = 1;
        let i = afterName + 1;
        let inQuote: string | null = null;
        while (i < text.length && depth > 0) {
            const ch = text[i];
            if (inQuote) {
                if (ch === '\\') {
                    i += 2;
                    continue;
                }
                if (ch === inQuote) {
                    inQuote = null;
                }
                i++;
                continue;
            }
            if (ch === '"' || ch === "'") {
                inQuote = ch;
                i++;
                continue;
            }
            if (ch === '(') { depth++; }
            else if (ch === ')') { depth--; }
            i++;
        }

        if (depth !== 0) {
            return null;
        }

        return {
            annotation: {
                fullName,
                simpleName,
                attrs: text.slice(afterName + 1, i - 1)
            },
            nextIndex: i
        };
    }

    /**
     * 从剥离注解后的参数声明尾部提取参数类型和变量名（同时支持 Java 与 Kotlin）。
     */
    static extractTypeAndName(afterAnnotation: string): { type: string; varName: string } | null {
        const cleaned = afterAnnotation
            .replace(/^(?:(?:final|val|var|vararg|crossinline|noinline)\s+)+/, '')
            .trim();
        if (!cleaned) {
            return null;
        }

        // Kotlin: "q: String"、"q: List<String>? = emptyList()"
        const kotlinMatch = cleaned.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
        if (kotlinMatch) {
            const rawKotlinType = this.stripTopLevelDefault(kotlinMatch[2]).trim().replace(/\?$/, '').trim();
            if (rawKotlinType) {
                return { type: rawKotlinType, varName: kotlinMatch[1] };
            }
        }

        // Java C-style array suffix: "String ids[]" -> normalize to "String[] ids"
        let normalizedJava = cleaned;
        const cArrayMatch = normalizedJava.match(/^([\s\S]+?\S)\s+([A-Za-z_$][\w$]*)((?:\s*\[\s*\])+)$/);
        if (cArrayMatch) {
            const brackets = cArrayMatch[3].replace(/\s+/g, '');
            normalizedJava = `${cArrayMatch[1]}${brackets} ${cArrayMatch[2]}`;
        }

        // Java standard: "String keyword"、"String[] ids"、"Map<String, Object> payload"、"String... tags"
        const javaMatch = normalizedJava.match(/^([\s\S]+?)\s+([A-Za-z_$][\w$]*)$/);
        if (javaMatch) {
            let rawType = javaMatch[1].trim();
            if (rawType.endsWith('...')) {
                rawType = `${rawType.slice(0, -3).trim()}[]`;
            }
            rawType = rawType.replace(/\s*\[\s*\]/g, '[]');
            if (rawType) {
                return { type: rawType, varName: javaMatch[2] };
            }
        }

        // 只有类型，无变量名（罕见兜底）
        const typeOnly = normalizedJava.match(/^([A-Za-z_$][\w$.<>[\],\s?]*)$/);
        if (typeOnly) {
            const raw = typeOnly[1].trim().replace(/\s*\[\s*\]/g, '[]');
            const fallbackVar = raw.replace(/[^A-Za-z0-9_$]/g, '').toLowerCase() || 'param';
            return { type: raw, varName: fallbackVar };
        }

        return null;
    }

    private static stripTopLevelDefault(typeAndDefault: string): string {
        let angleDepth = 0;
        let parenDepth = 0;
        for (let i = 0; i < typeAndDefault.length; i++) {
            const ch = typeAndDefault[i];
            if (ch === '<') { angleDepth++; }
            else if (ch === '>' && angleDepth > 0) { angleDepth--; }
            else if (ch === '(') { parenDepth++; }
            else if (ch === ')' && parenDepth > 0) { parenDepth--; }
            else if (ch === '=' && angleDepth === 0 && parenDepth === 0) {
                return typeAndDefault.slice(0, i);
            }
        }
        return typeAndDefault;
    }

    private parseSingleParameter(paramStr: string): EndpointParameter | null {
        const { annotations, remainder } = SpringParameterParser.extractLeadingAnnotations(paramStr);
        const binding = annotations.find(ann => SpringParameterParser.supportedAnnotations.has(ann.simpleName));
        if (!binding) {
            return null;
        }

        const typeAndName = SpringParameterParser.extractTypeAndName(remainder);
        if (!typeAndName) {
            return null;
        }

        const attrs = binding.attrs;
        const explicitName = attrs !== null ? this.extractAnnotationNameValue(attrs) : null;
        const defaultValue = attrs !== null ? this.extractDefaultValue(attrs) : undefined;
        const requiredStr = attrs !== null ? this.extractAttribute(attrs, 'required') : null;
        const isRequiredAttr = requiredStr !== null ? requiredStr === 'true' : null;

        const source = this.mapAnnotationToSource(binding.simpleName);
        const name = explicitName || typeAndName.varName;
        const isRequiredFinal = isRequiredAttr !== null ? isRequiredAttr : (defaultValue !== undefined ? false : true);

        return {
            name,
            type: typeAndName.type,
            source,
            originalCaseName: typeAndName.varName,
            isRequired: isRequiredFinal,
            defaultValue
        };
    }

    private extractAnnotationNameValue(attrs: string): string | null {
        const explicitMatch = attrs.match(/(?:^|,)\s*(?:value|name)\s*=\s*["']([^"']+)["']/);
        if (explicitMatch) {
            return explicitMatch[1];
        }

        const bareMatch = attrs.match(/^\s*["']([^"']+)["']\s*(?:,|$)/);
        if (bareMatch) {
            return bareMatch[1];
        }

        return null;
    }

    private extractDefaultValue(attrs: string): string | undefined {
        const quoted = attrs.match(/(?:^|,)\s*defaultValue\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/);
        if (quoted) {
            return quoted[1] ?? quoted[2] ?? '';
        }
        const raw = this.extractAttribute(attrs, 'defaultValue');
        return raw !== null ? raw.replace(/^["']|["']$/g, '') : undefined;
    }

    private extractAttribute(attrs: string, attrName: string): string | null {
        const pattern = new RegExp(`(?:^|,)\\s*${attrName}\\s*=\\s*([^,})]+)`);
        const match = attrs.match(pattern);
        return match ? match[1].trim() : null;
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
