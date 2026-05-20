import { RestEndpoint, HttpMethod } from '../models/types';
import { Logger } from '../utils/Logger';
import { TextProcessor } from '../utils/TextProcessor';

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

    /**
     * 解析方法级别的 JAX-RS 注解。
     *
     * @param content 原始类块内容（用于提取注解文本和路径值）
     * @param sanitizedContent 净化后的类块内容（用于括号匹配，避免字符串/注释干扰）
     * @param className 类名
     * @param classPath 类级别 @Path 路径
     * @param filePath 文件路径
     * @param lineIndex 预计算的换行符索引数组（用于快速行号计算）
     */
    parseMethodAnnotations(content: string, sanitizedContent: string, className: string, classPath: string | null, filePath: string, lineIndex?: number[]): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        // 使用更准确的方法匹配：先找方法签名，然后用括号深度匹配方法体
        const methodSignaturePattern = /(?:public|private|protected)?\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]+>)?\s+)+(\w+)\s*\(/g;
        let methodMatch;

        while ((methodMatch = methodSignaturePattern.exec(content)) !== null) {
            const methodName = methodMatch[1];
            const signatureStartIndex = methodMatch.index;

            // 在净化文本上查找方法体的 { 和 }，避免字符串/注释中的括号干扰
            let braceStart = -1;
            for (let i = signatureStartIndex; i < sanitizedContent.length; i++) {
                if (sanitizedContent[i] === '{') {
                    braceStart = i;
                    break;
                }
            }

            if (braceStart === -1) {
                continue; // 方法体开始括号未找到
            }

            // 在净化文本上计算括号深度找到方法体结束
            let braceDepth = 1;
            let braceEnd = braceStart + 1;
            while (braceEnd < sanitizedContent.length && braceDepth > 0) {
                if (sanitizedContent[braceEnd] === '{') {
                    braceDepth++;
                } else if (sanitizedContent[braceEnd] === '}') {
                    braceDepth--;
                }
                braceEnd++;
            }

            if (braceStart === -1) {
                continue; // 方法体开始括号未找到
            }

            // 从方法体开始位置向前扫描，找到 { 之前的内容
            // 注意：需要区分方法注解和参数注解（如 @FormParam），只收集 public/private/protected 之前的注解
            const annotationBlock = this.findMethodAnnotationBlock(content, braceStart);
            if (!annotationBlock) {
                continue;
            }

            // 计算注解块在 content 中的起始位置
            const annotationBlockStart = content.indexOf(annotationBlock, Math.max(0, braceStart - annotationBlock.length - 500));

            const methodEndpoints = this.parseJaxRsAnnotations(
                annotationBlock,
                annotationBlockStart,
                classPath || '',
                className,
                methodName,
                filePath,
                content,
                lineIndex
            );

            endpoints.push(...methodEndpoints);
        }

        return endpoints;
    }

    private parseJaxRsAnnotations(
        annotationBlock: string,
        annotationBlockStart: number,
        classPath: string,
        className: string,
        methodName: string,
        filePath: string,
        content: string,
        lineIndex?: number[]
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
            const match = annotationBlock.match(httpMethod.pattern);
            if (match) {
                // 使用正则匹配返回的精确位置
                const httpMethodIndexInBlock = match.index!;
                // 计算在原始content中的绝对位置
                const absolutePosition = annotationBlockStart + httpMethodIndexInBlock;
                // 使用快速行号计算
                const line = lineIndex
                    ? TextProcessor.getLineNumber(lineIndex, absolutePosition)
                    : TextProcessor.getLineNumberFallback(content, absolutePosition);

                // 查找方法级别的 @Path（取最后一个，避免匹配到类级 @Path）
                const methodPath = this.extractMethodPath(annotationBlock);

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

    /**
     * 从方法体 { 向前扫描，收集方法级注解（@GET/@POST/@Path 等）。
     * 跳过参数注解（@PathParam/@FormParam 等）。
     *
     * 策略：从 { 向前扫描，连续收集 @ 行，跳过非 @ 行（方法签名、参数），
     * 遇到 }（上一方法体结束）或 class（类声明）时停止。
     */
    private findMethodAnnotationBlock(content: string, braceIndex: number): string | null {
        let scanPos = braceIndex;
        while (scanPos > 0 && content[scanPos - 1] !== '\n') {
            scanPos--;
        }

        const methodAnnotations: string[] = [];

        while (scanPos > 0) {
            const prevNewlineIndex = scanPos - 1;
            if (prevNewlineIndex < 0) { break; }

            let prevLineStart = prevNewlineIndex;
            while (prevLineStart > 0 && content[prevLineStart - 1] !== '\n') {
                prevLineStart--;
            }

            const prevLine = content.substring(prevLineStart, prevNewlineIndex).trim();

            if (prevLine === '') {
                // 空行：如果已收集到注解，停止；否则继续
                if (methodAnnotations.length > 0) { break; }
                scanPos = prevLineStart;
                continue;
            }

            // 方法体闭括号 → 停止（防止跨到上一方法）
            if (prevLine === '}' || prevLine.startsWith('} ')) { break; }

            // 类声明 → 停止
            if (/\b(class|interface|object)\b/.test(prevLine)) { break; }

            // return 语句 → 停止（方法体内容）
            if (prevLine.startsWith('return ')) { break; }

            if (prevLine.startsWith('@')) {
                // 注解行：跳过参数注解
                if (/@(Path|Query|Form|Header)Param\s*\(/.test(prevLine)) {
                    scanPos = prevLineStart;
                    continue;
                }
                // 方法级注解，收集
                methodAnnotations.unshift(content.substring(prevLineStart, prevNewlineIndex));
                scanPos = prevLineStart;
            } else {
                // 非注解非空行（方法签名行、返回类型行等）→ 跳过，继续向前
                scanPos = prevLineStart;
                continue;
            }
        }

        if (methodAnnotations.length === 0) { return null; }
        return methodAnnotations.join('\n');
    }

    /**
     * 提取方法级别的 @Path（取最后一个，避免匹配类级 @Path）
     */
    private extractMethodPath(annotationBlock: string): string {
        const pattern = /@Path\s*\(\s*"([^"]+)"\s*\)/g;
        let match: RegExpExecArray | null;
        let lastPath = '';
        while ((match = pattern.exec(annotationBlock)) !== null) {
            lastPath = match[1].replace(/\s+/g, '');
        }
        return lastPath;
    }

    private combinePath(classPath: string, methodPath: string): string {
        // 规范化路径拼接，处理斜杠重复问题
        if (!classPath || classPath === '') {
            if (!methodPath || methodPath === '') {
                return '/';
            }
            return methodPath.startsWith('/') ? methodPath : '/' + methodPath;
        }

        // 去除类路径结尾的斜杠
        let base = classPath.startsWith('/') ? classPath : '/' + classPath;
        base = base.replace(/\/+$/, ''); // 去除结尾所有斜杠

        // 去除方法路径开头的斜杠
        if (!methodPath || methodPath === '') {
            return base; // 方法路径为空，只返回类路径
        }

        const method = methodPath.replace(/^\/+/, ''); // 去除开头所有斜杠
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
            framework: 'JAX-RS'
        };
    }
}