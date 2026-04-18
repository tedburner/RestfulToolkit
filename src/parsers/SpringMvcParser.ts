import { RestEndpoint, HttpMethod } from '../models/types';
import { Logger } from '../utils/Logger';

export class SpringMvcParser {
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    parseClassLevelPath(content: string, className: string): string | null {
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
            const annotationPattern = new RegExp(`${annotationName}\\s*\\([^)]*\\)`, 'g');
            let annotationMatch;

            while ((annotationMatch = annotationPattern.exec(content)) !== null) {
                const annotationText = annotationMatch[0];
                const annotationIndex = annotationMatch.index;

                // 从注解位置向前提取完整注解块（可能有多行）
                const annotationBlock = this.extractAnnotationBlockBackward(content, annotationIndex);
                if (!annotationBlock) {
                    continue;
                }

                // 从注解位置向后查找方法名
                const methodName = this.findMethodNameForward(content, annotationIndex + annotationText.length);
                if (!methodName) {
                    continue;
                }

                const line = this.getLineNumber(content, annotationIndex);
                const methodEndpoints = this.parseAnnotationsBlock(
                    annotationBlock,
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

    private extractAnnotationBlockBackward(content: string, startIndex: number): string | null {
        // 从注解位置向前查找所有相关注解
        let blockStart = startIndex;
        let lines = content.substring(0, startIndex).split('\n');
        let currentLineIndex = lines.length - 1;

        // 从当前行开始向前查找，找到所有连续的注解行
        let annotationLines: string[] = [];

        // 首先添加当前注解所在行到结束位置的文本
        let currentLineEnd = content.indexOf('\n', startIndex);
        if (currentLineEnd === -1) {
            currentLineEnd = content.length;
        }
        annotationLines.unshift(content.substring(startIndex, currentLineEnd));

        // 向前查找更多注解
        for (let i = currentLineIndex; i >= 0; i--) {
            const line = lines[i].trim();

            // 空行或非注解行则停止
            if (line === '' || (!line.startsWith('@') && !line.startsWith('//') && !line.startsWith('/*'))) {
                break;
            }

            // 只添加注解行
            if (line.startsWith('@')) {
                annotationLines.unshift(line);
            }
        }

        return annotationLines.join('\n');
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

    private getAnnotationBlock(content: string, methodIndex: number): string | null {
        let endIndex = methodIndex;
        while (endIndex > 0 && content[endIndex - 1] !== '\n') {
            endIndex--;
        }

        let startIndex = endIndex;
        let annotationDepth = 0;

        while (startIndex > 0) {
            const char = content[startIndex - 1];
            if (char === '@') {
                annotationDepth++;
            }
            if (annotationDepth === 0 && (char === '\n' || char === '{')) {
                break;
            }
            startIndex--;
        }

        if (annotationDepth === 0) {
            return null;
        }

        return content.substring(startIndex, endIndex);
    }

    private parseAnnotationsBlock(
        annotationBlock: string,
        classPath: string,
        className: string,
        methodName: string,
        filePath: string,
        line: number
    ): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        const mappingAnnotations = [
            { pattern: /@GetMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'GET' as HttpMethod },
            { pattern: /@PostMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'POST' as HttpMethod },
            { pattern: /@PutMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'PUT' as HttpMethod },
            { pattern: /@DeleteMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'DELETE' as HttpMethod },
            { pattern: /@PatchMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'PATCH' as HttpMethod },
            { pattern: /@GetMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'GET' as HttpMethod },
            { pattern: /@PostMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'POST' as HttpMethod },
            { pattern: /@PutMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'PUT' as HttpMethod },
            { pattern: /@DeleteMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'DELETE' as HttpMethod },
            { pattern: /@PatchMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'PATCH' as HttpMethod }
        ];

        for (const mapping of mappingAnnotations) {
            const matches = annotationBlock.matchAll(new RegExp(mapping.pattern.source, 'g'));
            for (const match of matches) {
                const pathValue = match[1];
                if (pathValue.includes(',')) {
                    const paths = pathValue.split(',').map(p => p.trim().replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, ''));
                    for (const path of paths) {
                        endpoints.push(this.createEndpoint(
                            mapping.method,
                            this.combinePath(classPath, path),
                            className,
                            methodName,
                            filePath,
                            line
                        ));
                    }
                } else {
                    endpoints.push(this.createEndpoint(
                        mapping.method,
                        this.combinePath(classPath, pathValue.replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, '')),
                        className,
                        methodName,
                        filePath,
                        line
                    ));
                }
            }
        }

        const requestMappingPattern = /@RequestMapping\s*\([^)]+\)/g;
        const requestMappingMatches = annotationBlock.matchAll(requestMappingPattern);

        for (const match of requestMappingMatches) {
            const annotation = match[0];
            const endpointsFromRequestMapping = this.parseRequestMapping(annotation, classPath, className, methodName, filePath, line);
            endpoints.push(...endpointsFromRequestMapping);
        }

        return endpoints;
    }

    private parseRequestMapping(
        annotation: string,
        classPath: string,
        className: string,
        methodName: string,
        filePath: string,
        line: number
    ): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        // 支持多种格式：
        // 1. @RequestMapping("/path") - 简写
        // 2. @RequestMapping(value = "/path") - 显式 value
        // 3. @RequestMapping(path = "/path") - 显式 path
        // 4. @RequestMapping(value = "/path", method = RequestMethod.GET) - 带方法

        const pathMatch = annotation.match(/(?:path\s*=\s*|value\s*=\s*)?"([^"]+)"/);
        const methodMatch = annotation.match(/method\s*=\s*RequestMethod\.(\w+)/);

        if (!pathMatch) {
            return endpoints;
        }

        const path = pathMatch[1].replace(/"/g, '').replace(/\s+/g, '');
        let method: HttpMethod = 'GET';

        if (methodMatch) {
            const methodNameUpper = methodMatch[1].toUpperCase();
            if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(methodNameUpper)) {
                method = methodNameUpper as HttpMethod;
            }
        }

        // 处理多路径情况
        if (annotation.includes(',') && annotation.match(/(?:path\s*=\s*|value\s*=\s*)?\{([^}]+)\}/)) {
            const pathsPart = annotation.match(/(?:path\s*=\s*|value\s*=\s*)?\{([^}]+)\}/);
            if (pathsPart) {
                const paths = pathsPart[1].split(',').map(p => p.trim().replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, ''));
                for (const p of paths) {
                    endpoints.push(this.createEndpoint(method, this.combinePath(classPath, p), className, methodName, filePath, line));
                }
                return endpoints;
            }
        }

        endpoints.push(this.createEndpoint(method, this.combinePath(classPath, path), className, methodName, filePath, line));
        return endpoints;
    }

    private combinePath(classPath: string, methodPath: string): string {
        if (!classPath || classPath === '') {
            return methodPath.startsWith('/') ? methodPath : '/' + methodPath;
        }

        const base = classPath.startsWith('/') ? classPath : '/' + classPath;
        const method = methodPath.startsWith('/') ? methodPath : '/' + methodPath;

        return base + method;
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