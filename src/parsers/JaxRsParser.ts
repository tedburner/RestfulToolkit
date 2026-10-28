import { RestEndpoint, HttpMethod } from '../models/types';
import { Logger } from '../utils/Logger';
import { TextProcessor } from '../utils/TextProcessor';

/** 方法级注解在类块原文中的连续片段（跨行注解完整保留）。 */
interface MethodAnnotationSpan {
    /** 注解 '@' 符号在类块中的偏移；净化文本与原文等长，坐标通用 */
    start: number;
    /** 注解原文（含参数） */
    raw: string;
}

interface MethodDeclaration {
    name: string;
    /** 声明起始偏移（净化文本坐标） */
    start: number;
    /** 参数列表左括号偏移 */
    parenIndex: number;
    /** 声明前的连续方法级注解 */
    annotations: MethodAnnotationSpan[];
}

interface DeclarationTerminator {
    kind: 'body' | 'semicolon' | 'other';
    index: number;
    /** kind 为 body 时，方法体结束括号的下一位置 */
    bodyEnd?: number;
}

/**
 * 解析 JAX-RS 类型级路径和方法级 HTTP 注解，并保留每个注解在原文件中的精确行号。
 *
 * 方法扫描限定在类型的直接成员层级：先匹配方法声明（返回类型 + 名称 + 参数列表），
 * 再按 `;`（接口/抽象方法）或 `{`（方法体）终结，并把整个方法体从扫描中跳过，
 * 因此方法体内的调用、局部语句不会产生幻影端点。
 */
export class JaxRsParser {
    private static readonly declarationPattern = new RegExp(
        '(?:(?:public|private|protected|internal|static|final|abstract|synchronized|default|native'
        + '|open|override|suspend|inline|operator|infix|tailrec)\\s+)*'
        + '(?:fun\\s+)?'
        // 类型参数：Java 在返回类型前（public <T> Response g()），Kotlin 在 fun 后（fun <T> foo()）
        + '(?:<[^<>]*>\\s*)?'
        + '(?:[\\w.$]+(?:\\s*<[^<>]*>)?\\s+)?'
        + '([A-Za-z_$][\\w$]*)\\s*\\(',
        'y'
    );

    private static readonly httpVerbAnnotations: ReadonlyArray<{ name: string; method: HttpMethod }> = [
        { name: 'GET', method: 'GET' },
        { name: 'POST', method: 'POST' },
        { name: 'PUT', method: 'PUT' },
        { name: 'DELETE', method: 'DELETE' },
        { name: 'PATCH', method: 'PATCH' }
    ];

    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    parseClassLevelPath(content: string, precomputedSanitized?: string): string | null {
        const sanitized = precomputedSanitized ?? TextProcessor.sanitize(content);
        const typeDeclarationIndex = sanitized.search(/\b(?:class|interface|object)\s+\w+/);
        if (typeDeclarationIndex === -1) {
            return null;
        }

        const pattern = /@(?:[\w.]+\.)?Path\s*\(/g;
        let match: RegExpExecArray | null;
        let classPath: string | null = null;
        while ((match = pattern.exec(sanitized)) !== null && match.index < typeDeclarationIndex) {
            const annotationText = this.extractAnnotationForward(content, match.index);
            const pathMatch = annotationText?.match(/@(?:[\w.]+\.)?Path\s*\(\s*"([^"]+)"\s*\)/);
            if (pathMatch) {
                classPath = pathMatch[1].replace(/\s+/g, '');
            }
        }
        return classPath;
    }

    /**
     * 解析方法级别的 JAX-RS 注解。
     *
     * @param content 原始类块内容（用于提取注解文本和路径值）
     * @param sanitizedContent 净化后的类块内容（用于结构扫描，避免字符串/注释干扰）
     * @param className 类名
     * @param classPath 类级别 @Path 路径
     * @param filePath 文件路径
     * @param lineIndex 预计算的换行符索引数组（用于快速行号计算）
     * @param contentOffset 当前类型块在原文件中的绝对字符偏移
     * @returns 当前类型直接声明的 JAX-RS 端点
     */
    parseMethodAnnotations(content: string, sanitizedContent: string, className: string, classPath: string | null, filePath: string, lineIndex?: number[], contentOffset: number = 0): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        for (const declaration of this.collectDirectMethodDeclarations(content, sanitizedContent)) {
            for (const verb of JaxRsParser.httpVerbAnnotations) {
                const verbSpan = declaration.annotations.find(span => this.annotationSimpleName(span) === verb.name);
                if (!verbSpan) {
                    continue;
                }

                const line = lineIndex
                    ? TextProcessor.getLineNumber(lineIndex, contentOffset + verbSpan.start)
                    : TextProcessor.getLineNumberFallback(content, verbSpan.start);

                const methodPath = this.extractMethodPath(declaration.annotations);
                endpoints.push(this.createEndpoint(
                    verb.method,
                    this.combinePath(classPath || '', methodPath),
                    className,
                    declaration.name,
                    filePath,
                    line
                ));
            }
        }

        return endpoints;
    }

    /**
     * 在净化文本上按直接成员层级扫描方法声明，返回声明前的注解片段。
     */
    private collectDirectMethodDeclarations(content: string, sanitized: string): MethodDeclaration[] {
        const declarations: MethodDeclaration[] = [];
        const bodyStart = this.findClassBodyStart(sanitized);
        if (bodyStart === -1) {
            return declarations;
        }

        let index = bodyStart;
        let memberStart = bodyStart;

        while (index < sanitized.length) {
            const ch = sanitized[index];
            if (/\s/.test(ch)) {
                index++;
                continue;
            }
            if (ch === '}') {
                break;
            }
            if (ch === ';') {
                index++;
                memberStart = index;
                continue;
            }
            if (ch === '@') {
                index = this.skipAnnotation(sanitized, index);
                continue;
            }
            if (ch === '{') {
                // 初始化块或字段初始化中的花括号块，不属于直接方法声明
                index = this.skipBraceBlock(sanitized, index);
                memberStart = index;
                continue;
            }

            const declaration = this.matchDeclaration(sanitized, index);
            if (!declaration) {
                // 非方法成员（字段、属性等）：跳到下一个成员边界并重置注解收集起点，
                // 避免被跳过成员的注解（如携带 HTTP 动词的字段）泄漏给下一个方法
                index = Math.max(this.skipToMemberBoundary(sanitized, index), index + 1);
                memberStart = index;
                continue;
            }

            const closeParen = this.findMatchingParen(sanitized, declaration.parenIndex);
            if (closeParen === -1) {
                index = declaration.parenIndex + 1;
                memberStart = index;
                continue;
            }

            const terminator = this.findDeclarationTerminator(sanitized, closeParen + 1);
            if (terminator.kind === 'other') {
                // 字段初始化等非方法声明，跳到下一个成员边界；重置注解收集起点，
                // 避免被跳过声明的注解（如 Kotlin 表达式函数体前的 @GET）泄漏给下一个方法
                index = Math.max(this.skipToMemberBoundary(sanitized, terminator.index), closeParen + 1);
                memberStart = index;
                continue;
            }

            declaration.annotations = this.collectAnnotationSpans(content, sanitized, memberStart, declaration.start);
            declarations.push(declaration);

            index = terminator.kind === 'body' && terminator.bodyEnd !== undefined
                ? terminator.bodyEnd
                : terminator.index + 1;
            memberStart = index;
        }

        return declarations;
    }

    private findClassBodyStart(sanitized: string): number {
        const declarationMatch = sanitized.match(/\b(?:class|interface|object)\s+\w+/);
        if (!declarationMatch || declarationMatch.index === undefined) {
            return -1;
        }
        const braceIndex = sanitized.indexOf('{', declarationMatch.index + declarationMatch[0].length);
        return braceIndex === -1 ? -1 : braceIndex + 1;
    }

    private matchDeclaration(sanitized: string, index: number): MethodDeclaration | null {
        JaxRsParser.declarationPattern.lastIndex = index;
        const match = JaxRsParser.declarationPattern.exec(sanitized);
        if (!match) {
            return null;
        }
        return {
            name: match[1],
            start: index,
            parenIndex: index + match[0].length - 1,
            annotations: []
        };
    }

    /**
     * 提取范围 [rangeStart, rangeEnd) 内的注解片段；净化文本中字符串与注释已被清空，
     * 只有真实注解的 '@' 会出现在该范围内。
     */
    private collectAnnotationSpans(content: string, sanitized: string, rangeStart: number, rangeEnd: number): MethodAnnotationSpan[] {
        const spans: MethodAnnotationSpan[] = [];
        let index = rangeStart;
        while (index < rangeEnd) {
            if (sanitized[index] !== '@') {
                index++;
                continue;
            }
            const end = this.skipAnnotation(sanitized, index);
            spans.push({ start: index, raw: content.substring(index, end) });
            index = end;
        }
        return spans;
    }

    private annotationSimpleName(span: MethodAnnotationSpan): string {
        const nameMatch = span.raw.match(/@([\w.]+)/);
        return nameMatch ? nameMatch[1].split('.').pop()! : '';
    }

    /**
     * 提取方法级别的 @Path（取最后一个，避免匹配到类级 @Path）。
     */
    private extractMethodPath(annotations: MethodAnnotationSpan[]): string {
        let lastPath = '';
        for (const span of annotations) {
            if (this.annotationSimpleName(span) !== 'Path') {
                continue;
            }
            const pathMatch = span.raw.match(/@(?:[\w.]+\.)?Path\s*\(\s*"([^"]+)"\s*\)/);
            if (pathMatch) {
                lastPath = pathMatch[1].replace(/\s+/g, '');
            }
        }
        return lastPath;
    }

    /**
     * 声明参数列表闭合后，识别 `;`（接口/抽象方法）或 `{`（方法体）终结符；
     * 中间只允许 throws/default 等子句字符，以及 Kotlin 返回类型的 `:` 与可空 `?`。
     */
    private findDeclarationTerminator(sanitized: string, from: number): DeclarationTerminator {
        for (let index = from; index < sanitized.length; index++) {
            const ch = sanitized[index];
            if (ch === '{') {
                return { kind: 'body', index, bodyEnd: this.skipBraceBlock(sanitized, index) };
            }
            if (ch === ';') {
                return { kind: 'semicolon', index };
            }
            if (!/[\w\s.,<>[\]&:?]/.test(ch)) {
                return { kind: 'other', index };
            }
        }
        return { kind: 'other', index: sanitized.length };
    }

    /**
     * 跳过非声明成员（字段等）到下一个成员边界：`;`、`@`、`{`、`}` 或行尾（Kotlin 无分号）。
     */
    private skipToMemberBoundary(sanitized: string, from: number): number {
        let parenDepth = 0;
        let braceDepth = 0;
        for (let index = from; index < sanitized.length; index++) {
            const ch = sanitized[index];
            if (ch === '(') {
                parenDepth++;
            } else if (ch === ')') {
                parenDepth--;
            } else if (ch === '{') {
                if (parenDepth === 0 && braceDepth === 0) {
                    return index;
                }
                braceDepth++;
            } else if (ch === '}') {
                if (braceDepth === 0) {
                    return index;
                }
                braceDepth--;
            } else if (ch === ';' || ch === '@' || ch === '\n') {
                if (parenDepth === 0 && braceDepth === 0) {
                    return ch === ';' ? index + 1 : index;
                }
            }
        }
        return sanitized.length;
    }

    private skipAnnotation(sanitized: string, atIndex: number): number {
        let index = atIndex + 1;
        while (index < sanitized.length && /[\w.]/.test(sanitized[index])) {
            index++;
        }
        while (index < sanitized.length && /\s/.test(sanitized[index])) {
            index++;
        }
        if (sanitized[index] === '(') {
            const closeIndex = this.findMatchingParen(sanitized, index);
            if (closeIndex !== -1) {
                return closeIndex + 1;
            }
        }
        return index;
    }

    private findMatchingParen(sanitized: string, openIndex: number): number {
        let depth = 0;
        for (let index = openIndex; index < sanitized.length; index++) {
            const ch = sanitized[index];
            if (ch === '(') {
                depth++;
            } else if (ch === ')') {
                depth--;
                if (depth === 0) {
                    return index;
                }
            }
        }
        return -1;
    }

    private skipBraceBlock(sanitized: string, openIndex: number): number {
        let depth = 0;
        for (let index = openIndex; index < sanitized.length; index++) {
            const ch = sanitized[index];
            if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    return index + 1;
                }
            }
        }
        return sanitized.length;
    }

    private extractAnnotationForward(content: string, startIndex: number): string | null {
        if (content[startIndex] !== '@') {
            return null;
        }

        let nameEnd = startIndex;
        while (nameEnd < content.length && content[nameEnd] !== '(' && !/\s/.test(content[nameEnd])) {
            nameEnd++;
        }
        while (nameEnd < content.length && /\s/.test(content[nameEnd])) {
            nameEnd++;
        }
        if (content[nameEnd] !== '(') {
            return content.substring(startIndex, nameEnd);
        }

        let depth = 1;
        let endIndex = nameEnd + 1;
        while (endIndex < content.length && depth > 0) {
            if (content[endIndex] === '(') {
                depth++;
            } else if (content[endIndex] === ')') {
                depth--;
            }
            endIndex++;
        }
        return depth === 0 ? content.substring(startIndex, endIndex) : null;
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

        const method = methodPath.replace(/^\/+/, '');
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
