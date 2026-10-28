import { EndpointParameter } from '../models/types';
import { SpringParameterParser } from './SpringParameterParser';

export class JaxRsParameterParser {
    private springParser: SpringParameterParser;

    constructor() {
        this.springParser = new SpringParameterParser();
    }

    /**
     * 解析 JAX-RS 方法参数。
     * 复用 SpringParameterParser 处理 @RequestBody，自行处理 JAX-RS 专属注解。
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

    private extractTypeAndName(afterAnnotation: string): { type: string; varName: string } | null {
        // Kotlin: "id: Long"、"q: String?"
        const kotlinMatch = afterAnnotation.match(/^(\w+)\s*:\s*(.+?)(?:\s*=.*)?$/);
        if (kotlinMatch) {
            const kotlinType = kotlinMatch[2].trim().replace(/\?$/, '').trim();
            if (kotlinType) {
                return { type: kotlinType, varName: kotlinMatch[1] };
            }
        }
        const match = afterAnnotation.match(/([\w<>]+)\s+(\w+)/);
        if (match) {
            return { type: match[1], varName: match[2] };
        }
        const typeOnly = afterAnnotation.match(/^([\w<>]+)/);
        if (typeOnly) {
            return { type: typeOnly[1], varName: typeOnly[1].toLowerCase() };
        }
        return null;
    }

    private parseSingleParameter(paramStr: string): EndpointParameter | null {
        // JAX-RS 专属注解
        const jaxRsAnnotations = [
            { name: 'PathParam', source: 'path' as const },
            { name: 'QueryParam', source: 'query' as const },
            { name: 'FormParam', source: 'form' as const },
            { name: 'HeaderParam', source: 'header' as const },
        ];

        for (const ann of jaxRsAnnotations) {
            const pattern = new RegExp(`@${ann.name}\\s*\\(["']([^"']+)["']\\)`);
            const match = paramStr.match(pattern);
            if (match) {
                const afterAnnotation = paramStr.substring(match.index! + match[0].length).trim();
                const typeAndName = this.extractTypeAndName(afterAnnotation);
                if (!typeAndName) { continue; }

                return {
                    name: match[1],
                    type: typeAndName.type,
                    source: ann.source,
                    originalCaseName: typeAndName.varName,
                    isRequired: true
                };
            }
        }

        // 降级到 Spring 解析器处理 @RequestBody（共享注解）
        const springParams = this.springParser.parseMethodParameters(methodSignatureWrapper(paramStr));
        if (springParams.length > 0) {
            return springParams[0];
        }

        return null;
    }
}

/**
 * 将单个参数包裹为伪方法签名，供 SpringParameterParser 复用。
 */
function methodSignatureWrapper(paramStr: string): string {
    return `method(${paramStr})`;
}
