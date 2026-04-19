import { RestEndpoint, HttpMethod } from '../models/types';
import { Logger } from '../utils/Logger';

export class JaxRsParser {
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    parseClassLevelPath(content: string): string | null {
        const pattern = /@Path\s*\(\s*"([^"]+)"\s*\)/;
        const match = content.match(pattern);

        if (match) {
            return match[1].replace(/\s+/g, '');
        }

        return null;
    }

    parseMethodAnnotations(content: string, className: string, classPath: string | null, filePath: string): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        // 更精确的方法匹配正则，支持泛型返回类型
        const methodPattern = /(?:public|private|protected)?\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]+>)?\s+)+(\w+)\s*\([^)]*\)\s*\{[^}]*\}/g;
        let methodMatch;

        while ((methodMatch = methodPattern.exec(content)) !== null) {
            const methodName = methodMatch[1];
            const methodStartIndex = methodMatch.index;

            const annotationBlock = this.getAnnotationBlock(content, methodStartIndex);
            if (!annotationBlock) {
                continue;
            }

            const methodEndpoints = this.parseJaxRsAnnotations(
                annotationBlock,
                classPath || '',
                className,
                methodName,
                filePath,
                this.getLineNumber(content, methodStartIndex)
            );

            endpoints.push(...methodEndpoints);
        }

        return endpoints;
    }

    private parseJaxRsAnnotations(
        annotationBlock: string,
        classPath: string,
        className: string,
        methodName: string,
        filePath: string,
        line: number
    ): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        const httpMethods: { pattern: RegExp; method: HttpMethod }[] = [
            { pattern: /@GET/, method: 'GET' },
            { pattern: /@POST/, method: 'POST' },
            { pattern: /@PUT/, method: 'PUT' },
            { pattern: /@DELETE/, method: 'DELETE' },
            { pattern: /@PATCH/, method: 'PATCH' }
        ];

        for (const httpMethod of httpMethods) {
            if (annotationBlock.match(httpMethod.pattern)) {
                const pathMatch = annotationBlock.match(/@Path\s*\(\s*"([^"]+)"\s*\)/);
                const methodPath = pathMatch ? pathMatch[1].replace(/\s+/g, '') : '';

                endpoints.push(this.createEndpoint(
                    httpMethod.method,
                    this.combinePath(classPath, methodPath),
                    className,
                    methodName,
                    filePath,
                    line
                ));
            }
        }

        return endpoints;
    }

    private getAnnotationBlock(content: string, methodIndex: number): string | null {
        // 找到方法签名前面的换行符位置
        // methodIndex 指向正则匹配的起始位置（可能包含换行符）
        // 我们需要找到方法签名真正开始的行首位置
        let endIndex = methodIndex;

        // 如果 methodIndex 指向换行符，向前跳过换行符本身
        while (endIndex < content.length && content[endIndex] === '\n') {
            endIndex++;
        }

        // 现在 endIndex 指向方法签名的第一个非换行符字符（可能是空格或实际内容）
        // 向前查找这一行的行首
        while (endIndex > 0 && content[endIndex - 1] !== '\n') {
            endIndex--;
        }

        let startIndex = endIndex;

        // 向前查找所有连续的注解行
        while (startIndex > 0) {
            // 找到当前行前面的换行符（前一行的结尾）
            let prevNewlineIndex = startIndex - 1;
            if (prevNewlineIndex < 0) {
                break;
            }

            // 找到前一行的开始位置
            let prevLineStart = prevNewlineIndex;
            while (prevLineStart > 0 && content[prevLineStart - 1] !== '\n') {
                prevLineStart--;
            }

            // 获取前一行的内容（不包含换行符）
            const prevLine = content.substring(prevLineStart, prevNewlineIndex).trim();

            // 如果前一行不是注解行（不以 @ 开头），停止查找
            if (prevLine === '' || !prevLine.startsWith('@')) {
                break;
            }

            // 前一行是注解行，继续向前查找
            startIndex = prevLineStart;
        }

        // 返回从 startIndex 到 endIndex 的内容（所有注解行）
        const block = content.substring(startIndex, endIndex);
        if (!block.trim().startsWith('@')) {
            return null;
        }
        return block;
    }

    private combinePath(classPath: string, methodPath: string): string {
        if (!classPath || classPath === '') {
            if (!methodPath || methodPath === '') {
                return '/';
            }
            return methodPath.startsWith('/') ? methodPath : '/' + methodPath;
        }

        const base = classPath.startsWith('/') ? classPath : '/' + classPath;

        if (!methodPath || methodPath === '') {
            return base;
        }

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
            framework: 'JAX-RS'
        };
    }

    private getLineNumber(content: string, index: number): number {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }
}