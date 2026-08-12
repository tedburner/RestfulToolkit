import { RestEndpoint, HttpMethod } from '../models/types';
import { Logger } from '../utils/Logger';
import { TextProcessor } from '../utils/TextProcessor';

export class SpringMvcParser {
    private static readonly httpMethodMap: ReadonlyMap<string, HttpMethod> = new Map([
        ['GetMapping', 'GET'],
        ['PostMapping', 'POST'],
        ['PutMapping', 'PUT'],
        ['DeleteMapping', 'DELETE'],
        ['PatchMapping', 'PATCH'],
    ]);

    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    parseClassLevelPath(content: string): string | null {
        const sanitized = TextProcessor.sanitize(content);
        const typeDeclarationIndex = this.findTypeDeclarationIndex(sanitized);
        if (typeDeclarationIndex === -1) {
            return null;
        }

        const pattern = /@(?:[\w.]+\.)?RequestMapping(?:\s|\(|$)/g;
        let match: RegExpExecArray | null;
        let annotationText: string | null = null;
        while ((match = pattern.exec(sanitized)) !== null && match.index < typeDeclarationIndex) {
            annotationText = this.extractAnnotationForward(content, match.index);
        }

        const paths = annotationText ? this.extractPathValues(annotationText) : [];
        return paths.length > 0 ? paths[0] : null;
    }

    parseMethodAnnotations(content: string, className: string, classPath: string | null, filePath: string, lineIndex?: number[], contentOffset: number = 0): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];
        const sanitized = TextProcessor.sanitize(content);
        const typeDeclarationIndex = this.findTypeDeclarationIndex(sanitized);

        const annotationPattern = /@(?:[\w.]+\.)?(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)(?:\s|\(|$)/g;
        let annotationMatch: RegExpExecArray | null;

        while ((annotationMatch = annotationPattern.exec(sanitized)) !== null) {
            const annotationIndex = annotationMatch.index;
            const simpleName = annotationMatch[1];

            // 从注解位置向后提取完整注解文本（包括跨行）
            const annotationText = this.extractAnnotationForward(content, annotationIndex);
            if (!annotationText) {
                continue;
            }

            if (simpleName === 'RequestMapping' && typeDeclarationIndex !== -1 && annotationIndex < typeDeclarationIndex) {
                continue;
            }

            // 从注解位置向后查找方法名
            const methodStartIndex = annotationIndex + annotationText.length;
            const methodName = this.findMethodNameForward(sanitized, methodStartIndex);
            if (!methodName) {
                continue;
            }

            // 计算注解起始行号（直接从注解的 @ 符号位置计算）
            const line = lineIndex
                ? TextProcessor.getLineNumber(lineIndex, contentOffset + annotationIndex)
                : TextProcessor.getLineNumberFallback(content, annotationIndex);
            const methodEndpoints = this.parseAnnotationText(
                annotationText,
                classPath || '',
                className,
                methodName,
                filePath,
                line
            );

            endpoints.push(...methodEndpoints);
        }

        return endpoints;
    }

    private extractAnnotationForward(content: string, startIndex: number): string | null {
        // 确保 startIndex 指向 @ 符号
        if (content[startIndex] !== '@') {
            return null;
        }

        // 查找注解名称结束位置（空格或左括号）
        let nameEnd = startIndex;
        while (nameEnd < content.length && content[nameEnd] !== '(' && content[nameEnd] !== ' ' && content[nameEnd] !== '\n') {
            nameEnd++;
        }

        // 如果没有括号，说明是简写注解（如 @GetMapping）
        if (content[nameEnd] !== '(') {
            return content.substring(startIndex, nameEnd);
        }

        // 有括号，需要找到对应的闭合括号（考虑嵌套）
        let depth = 1;
        let endIndex = nameEnd + 1;

        while (endIndex < content.length && depth > 0) {
            const char = content[endIndex];
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            }
            endIndex++;
        }

        if (depth !== 0) {
            return null; // 括号不匹配
        }

        return content.substring(startIndex, endIndex);
    }

    private findMethodNameForward(content: string, startIndex: number): string | null {
        let index = startIndex;

        while (index < content.length) {
            while (index < content.length && /\s/.test(content[index])) {
                index++;
            }
            if (content[index] !== '@') {
                break;
            }
            const annotation = this.extractAnnotationForward(content, index);
            if (!annotation) {
                return null;
            }
            index += annotation.length;
        }

        const declarationStart = index;
        while (index < content.length) {
            const char = content[index];
            if (char === '@') {
                const annotation = this.extractAnnotationForward(content, index);
                if (!annotation) {
                    return null;
                }
                index += annotation.length;
                continue;
            }
            if (char === '(') {
                const declarationPrefix = content.substring(declarationStart, index);
                const methodMatch = declarationPrefix.match(/([A-Za-z_$][\w$]*)\s*$/);
                return methodMatch ? methodMatch[1] : null;
            }
            if (char === '{' || char === '}' || char === ';') {
                return null;
            }
            index++;
        }

        return null;
    }

    private findTypeDeclarationIndex(content: string): number {
        return content.search(/\b(?:class|interface|object)\s+\w+/);
    }

    /**
     * 解析单个注解文本（支持跨行格式）
     */
    private parseAnnotationText(
        annotationText: string,
        classPath: string,
        className: string,
        methodName: string,
        filePath: string,
        line: number
    ): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        // 提取注解名称
        const annotationNameMatch = annotationText.match(/@([\w.]+)/);
        if (!annotationNameMatch) {
            return endpoints;
        }

        const annotationName = annotationNameMatch[1].split('.').pop()!;

        // 根据注解名称确定 HTTP 方法
        const httpMethod = SpringMvcParser.httpMethodMap.get(annotationName) ?? null;

        const pathValues = this.extractPathValues(annotationText);

        if (httpMethod) {
            // 简写注解（@GetMapping 等）
            if (pathValues.length > 0) {
                this.addEndpoints(endpoints, [httpMethod], pathValues, classPath, className, methodName, filePath, line);
            } else if (annotationText.includes('(') && annotationText.includes(')')) {
                // 有括号但没有路径参数，可能是默认路径
                // 例如：@GetMapping() 这种情况忽略
            }
        } else if (annotationName === 'RequestMapping') {
            // @RequestMapping 注解（需要提取 method 参数）
            if (pathValues.length > 0) {
                this.addEndpoints(endpoints, this.extractRequestMethods(annotationText), pathValues, classPath, className, methodName, filePath, line);
            }
        }

        return endpoints;
    }

    private addEndpoints(
        endpoints: RestEndpoint[],
        methods: HttpMethod[],
        paths: string[],
        classPath: string,
        className: string,
        methodName: string,
        filePath: string,
        line: number
    ): void {
        for (const method of methods) {
            for (const path of paths) {
                endpoints.push(this.createEndpoint(
                    method,
                    this.combinePath(classPath, path),
                    className,
                    methodName,
                    filePath,
                    line
                ));
            }
        }
    }

    private extractRequestMethods(annotationText: string): HttpMethod[] {
        const args = this.extractAnnotationArguments(annotationText);
        if (!args) {
            return ['GET'];
        }

        const methodAttr = args.match(/(?:^|,)\s*method\s*=\s*(?:\{([\s\S]*?)\}|([^,)]+))/);
        if (!methodAttr) {
            return ['GET'];
        }

        const rawValue = methodAttr[1] || methodAttr[2] || '';
        const methods: HttpMethod[] = [];
        const methodPattern = /(?:RequestMethod\.)?(GET|POST|PUT|DELETE|PATCH)\b/g;
        let match: RegExpExecArray | null;
        while ((match = methodPattern.exec(rawValue)) !== null) {
            methods.push(match[1] as HttpMethod);
        }

        return methods.length > 0 ? methods : ['GET'];
    }

    private extractPathValues(annotationText: string): string[] {
        const args = this.extractAnnotationArguments(annotationText);
        if (args === null) {
            return [];
        }

        const arrayValue = this.extractPathArrayArgument(args);
        if (arrayValue !== null) {
            return this.extractQuotedStrings(arrayValue);
        }

        const singleValue = this.extractPathStringArgument(args);
        return singleValue ? [singleValue] : [];
    }

    private extractAnnotationArguments(annotationText: string): string | null {
        const parenStart = annotationText.indexOf('(');
        if (parenStart === -1) {
            return null;
        }

        let depth = 0;
        for (let i = parenStart; i < annotationText.length; i++) {
            const char = annotationText[i];
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    return annotationText.substring(parenStart + 1, i);
                }
            }
        }

        return null;
    }

    private extractPathArrayArgument(args: string): string | null {
        const explicitArray = args.match(/(?:^|,)\s*(?:value|path)\s*=\s*\{([\s\S]*?)\}/);
        if (explicitArray) {
            return explicitArray[1];
        }

        const directArray = args.match(/^\s*\{([\s\S]*?)\}/);
        return directArray ? directArray[1] : null;
    }

    private extractPathStringArgument(args: string): string | null {
        const explicitString = args.match(/(?:^|,)\s*(?:value|path)\s*=\s*["']([^"']+)["']/);
        if (explicitString) {
            return this.normalizePathValue(explicitString[1]);
        }

        const directString = args.match(/^\s*["']([^"']+)["']/);
        return directString ? this.normalizePathValue(directString[1]) : null;
    }

    private extractQuotedStrings(value: string): string[] {
        const paths: string[] = [];
        const quotedPattern = /["']([^"']+)["']/g;
        let match: RegExpExecArray | null;
        while ((match = quotedPattern.exec(value)) !== null) {
            paths.push(this.normalizePathValue(match[1]));
        }
        return paths;
    }

    private normalizePathValue(value: string): string {
        return value.replace(/\s+/g, '');
    }

    private combinePath(classPath: string, methodPath: string): string {
        // 规范化路径拼接，处理斜杠重复问题
        if (!classPath || classPath === '') {
            return methodPath.startsWith('/') ? methodPath : '/' + methodPath;
        }

        // 去除类路径结尾的斜杠
        let base = classPath.startsWith('/') ? classPath : '/' + classPath;
        base = base.replace(/\/+$/, ''); // 去除结尾所有斜杠

        // 去除方法路径开头的斜杠
        const method = methodPath.replace(/^\/+/, ''); // 去除开头所有斜杠

        // 确保方法路径开头有一个斜杠
        if (method === '') {
            return base; // 方法路径为空，只返回类路径
        }

        return base + '/' + method;
    }

    private createEndpoint(
        method: HttpMethod,
        path: string,
        className: string,
        methodName: string,
        filePath: string,
        line: number
    ): RestEndpoint {
        return {
            method,
            path,
            className,
            methodName,
            file: filePath,
            line,
            framework: 'Spring'
        };
    }
}
