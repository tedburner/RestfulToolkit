import { RestEndpoint, HttpMethod } from '../models/types';
import { Logger } from '../utils/Logger';

export class SpringMvcParser {
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    parseClassLevelPath(content: string): string | null {
        const patterns = [
            /@RequestMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/,
            /@RequestMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                if (match[1].includes(',')) {
                    const paths = match[1].split(',').map(p => p.trim().replace(/"/g, '').replace(/'/g, ''));
                    return paths[0].replace(/\s+/g, '');
                }
                return match[1].replace(/\s+/g, '').replace(/"/g, '').replace(/'/g, '');
            }
        }

        return null;
    }

    parseMethodAnnotations(content: string, className: string, classPath: string | null, filePath: string): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        // 新方法：直接查找 REST 注解，然后提取方法和注解
        const mappingAnnotations = [
            '@GetMapping', '@PostMapping', '@PutMapping', '@DeleteMapping', '@PatchMapping', '@RequestMapping'
        ];

        for (const annotationName of mappingAnnotations) {
            // 使用更简单的正则：只匹配注解名称，不匹配完整注解（避免跨行问题）
            const annotationPattern = new RegExp(`${annotationName}(?:\\s|\\(|$)`, 'g');
            let annotationMatch;

            while ((annotationMatch = annotationPattern.exec(content)) !== null) {
                const annotationIndex = annotationMatch.index;

                // 从注解位置向后提取完整注解文本（包括跨行）
                const annotationText = this.extractAnnotationForward(content, annotationIndex);
                if (!annotationText) {
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
                const line = this.getLineNumber(content, annotationIndex);
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
        const annotationNameMatch = annotationText.match(/@(\w+)/);
        if (!annotationNameMatch) {
            return endpoints;
        }

        const annotationName = annotationNameMatch[1];

        // 根据注解名称确定 HTTP 方法
        let httpMethod: HttpMethod | null = null;
        if (annotationName === 'GetMapping') {
            httpMethod = 'GET';
        } else if (annotationName === 'PostMapping') {
            httpMethod = 'POST';
        } else if (annotationName === 'PutMapping') {
            httpMethod = 'PUT';
        } else if (annotationName === 'DeleteMapping') {
            httpMethod = 'DELETE';
        } else if (annotationName === 'PatchMapping') {
            httpMethod = 'PATCH';
        }

        // 提取路径（支持多种格式）
        // 重要：先匹配路径数组，再匹配单路径（避免误匹配其他数组参数）
        // 路径数组必须满足以下条件之一：
        // 1. 明确带有 value= 或 path= 参数名
        // 2. 注解名称后直接是括号（无参数名的第一个参数）
        // 排除：produces/consumes等参数数组（有明确的参数名）、路径变量{id}（无引号）
        let pathArrayMatch = annotationText.match(/(?:value\s*=\s*|path\s*=\s*)\{("[^"]+"\s*(?:,\s*"[^"]+"\s*)+)\}/);

        // 如果没有明确参数名的数组，检查是否紧跟注解名（第一个参数）
        if (!pathArrayMatch) {
            const directArrayMatch = annotationText.match(/@\w+\s*\(\s*\{("[^"]+"\s*(?:,\s*"[^"]+"\s*)+)\}/);
            if (directArrayMatch) {
                pathArrayMatch = directArrayMatch;
            }
        }

        const pathMatch = !pathArrayMatch ? annotationText.match(/(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"/) : null;

        if (httpMethod) {
            // 简写注解（@GetMapping 等）
            if (pathMatch) {
                const pathValue = pathMatch[1];
                endpoints.push(this.createEndpoint(
                    httpMethod,
                    this.combinePath(classPath, pathValue.replace(/"/g, '').replace(/\s+/g, '')),
                    className,
                    methodName,
                    filePath,
                    line
                ));
            } else if (pathArrayMatch) {
                // 多路径情况
                const paths = pathArrayMatch[1].split(',').map(p => p.trim().replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, ''));
                for (const path of paths) {
                    endpoints.push(this.createEndpoint(
                        httpMethod,
                        this.combinePath(classPath, path),
                        className,
                        methodName,
                        filePath,
                        line
                    ));
                }
            } else if (annotationText.includes('(') && annotationText.includes(')')) {
                // 有括号但没有路径参数，可能是默认路径
                // 例如：@GetMapping() 这种情况忽略
            }
        } else if (annotationName === 'RequestMapping') {
            // @RequestMapping 注解（需要提取 method 参数）
            const methodMatch = annotationText.match(/method\s*=\s*RequestMethod\.(\w+)/);

            if (pathMatch) {
                const pathValue = pathMatch[1];
                let method: HttpMethod = 'GET';

                if (methodMatch) {
                    const methodNameUpper = methodMatch[1].toUpperCase();
                    if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(methodNameUpper)) {
                        method = methodNameUpper as HttpMethod;
                    }
                }

                endpoints.push(this.createEndpoint(
                    method,
                    this.combinePath(classPath, pathValue.replace(/"/g, '').replace(/\s+/g, '')),
                    className,
                    methodName,
                    filePath,
                    line
                ));
            } else if (pathArrayMatch) {
                // 多路径情况
                const paths = pathArrayMatch[1].split(',').map(p => p.trim().replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, ''));
                let method: HttpMethod = 'GET';

                if (methodMatch) {
                    const methodNameUpper = methodMatch[1].toUpperCase();
                    if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(methodNameUpper)) {
                        method = methodNameUpper as HttpMethod;
                    }
                }

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

        return endpoints;
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

    private getLineNumber(content: string, index: number): number {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }
}