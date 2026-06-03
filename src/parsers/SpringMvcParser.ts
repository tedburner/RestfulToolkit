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
        const requestMappingMatch = content.match(/@(?:[\w.]+\.)?RequestMapping(?:\s|\(|$)/);
        if (!requestMappingMatch) {
            return null;
        }

        const annotationText = this.extractAnnotationForward(content, requestMappingMatch.index!);
        if (!annotationText) {
            return null;
        }

        const paths = this.extractPathValues(annotationText);
        return paths.length > 0 ? paths[0] : null;
    }

    parseMethodAnnotations(content: string, className: string, classPath: string | null, filePath: string, lineIndex?: number[]): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        // 新方法：直接查找 REST 注解，然后提取方法和注解
        const mappingAnnotations = [
            '@GetMapping', '@PostMapping', '@PutMapping', '@DeleteMapping', '@PatchMapping', '@RequestMapping'
        ];

        for (const annotationName of mappingAnnotations) {
            // 使用更简单的正则：只匹配注解名称，不匹配完整注解（避免跨行问题）
            const simpleName = annotationName.slice(1);
            const annotationPattern = new RegExp(`@(?:[\\w.]+\\.)?${simpleName}(?:\\s|\\(|$)`, 'g');
            let annotationMatch;

            while ((annotationMatch = annotationPattern.exec(content)) !== null) {
                const annotationIndex = annotationMatch.index;

                // 从注解位置向后提取完整注解文本（包括跨行）
                const annotationText = this.extractAnnotationForward(content, annotationIndex);
                if (!annotationText) {
                    continue;
                }

                if (simpleName === 'RequestMapping' && this.isClassLevelRequestMapping(content, annotationIndex, annotationText.length)) {
                    continue;
                }

                // 从注解位置向后查找方法名
                const methodStartIndex = annotationIndex + annotationText.length;
                const methodName = this.findMethodNameForward(content, methodStartIndex);
                if (!methodName) {
                    continue;
                }

                // 跳过类级别的 @RequestMapping（检查注解后是否有 class 关键字）
                if (annotationName === '@RequestMapping') {
                    const searchArea = content.substring(annotationIndex, annotationIndex + 300);
                    if (searchArea.match(/(?:public|private|protected)?\s+class\s+\w+/)) {
                        // 这是类级别注解，跳过
                        continue;
                    }
                }

                // 计算注解起始行号（直接从注解的 @ 符号位置计算）
                const line = lineIndex
                    ? TextProcessor.getLineNumber(lineIndex, annotationIndex)
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
        }

        return endpoints;
    }

    /**
     * 从注解起始位置向后提取完整注解文本（支持跨行）
     */
    private isClassLevelRequestMapping(content: string, annotationIndex: number, annotationLength: number): boolean {
        const searchArea = content.substring(annotationIndex + annotationLength, annotationIndex + annotationLength + 1000);
        const bodyIndex = searchArea.indexOf('{');
        const declarationArea = bodyIndex === -1 ? searchArea : searchArea.substring(0, bodyIndex);
        const typeDeclarationMatch = declarationArea.match(/\b(?:class|interface|object)\s+\w+/);

        if (!typeDeclarationMatch) {
            return false;
        }

        const beforeType = declarationArea.substring(0, typeDeclarationMatch.index);
        return !/\w+\s*\([^)]*$/.test(beforeType);
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
        // 从注解后面查找第一个方法名
        // 匹配模式: public/private/protected? return-type methodName(
        const searchArea = content.substring(startIndex, startIndex + 500); // 搜索接下来的500字符

        const methodPattern = /(?:public|private|protected)?\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]+>)?\s+)+(\w+)\s*\(/;
        const match = searchArea.match(methodPattern);

        if (match && match[1]) {
            return match[1];
        }

        return null;
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
