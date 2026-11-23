import { EndpointParameter } from '../models/types';
import { SpringParameterParser } from './SpringParameterParser';

export class JaxRsParameterParser {
    private static readonly jaxRsSourceMap: ReadonlyMap<string, EndpointParameter['source']> = new Map([
        ['PathParam', 'path'],
        ['QueryParam', 'query'],
        ['FormParam', 'form'],
        ['HeaderParam', 'header']
    ]);

    private springParser: SpringParameterParser;

    constructor() {
        this.springParser = new SpringParameterParser();
    }

    /**
     * 解析 JAX-RS 方法参数。
     * 复用 SpringParameterParser 处理参数切分、前置注解剥离与 @RequestBody，自行处理 JAX-RS 专属注解。
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

    private parseSingleParameter(paramStr: string): EndpointParameter | null {
        const { annotations, remainder } = SpringParameterParser.extractLeadingAnnotations(paramStr);
        const jaxRsBinding = annotations.find(ann => JaxRsParameterParser.jaxRsSourceMap.has(ann.simpleName));
        if (jaxRsBinding && jaxRsBinding.attrs !== null) {
            const nameMatch = jaxRsBinding.attrs.match(/(?:^\s*value\s*=\s*|^\s*)["']([^"']+)["']/);
            const typeAndName = SpringParameterParser.extractTypeAndName(remainder);
            if (nameMatch && typeAndName) {
                const defaultAnn = annotations.find(ann => ann.simpleName === 'DefaultValue' && ann.attrs !== null);
                const defaultMatch = defaultAnn?.attrs?.match(/^\s*["']([^"']*)["']/);
                const defaultValue = defaultMatch ? defaultMatch[1] : undefined;

                return {
                    name: nameMatch[1],
                    type: typeAndName.type,
                    source: JaxRsParameterParser.jaxRsSourceMap.get(jaxRsBinding.simpleName)!,
                    originalCaseName: typeAndName.varName,
                    isRequired: defaultValue === undefined,
                    defaultValue
                };
            }
        }

        // 降级到 Spring 解析器处理 @RequestBody（共享注解）
        const springParams = this.springParser.parseMethodParameters(`method(${paramStr})`);
        return springParams.length > 0 ? springParams[0] : null;
    }
}
