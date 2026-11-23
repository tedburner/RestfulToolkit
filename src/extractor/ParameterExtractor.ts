import * as vscode from 'vscode';
import { EndpointCopyInfo, EndpointParameter } from '../models/types';
import { SpringParameterParser } from './SpringParameterParser';
import { JaxRsParameterParser } from './JaxRsParameterParser';
import { DtoFieldExtractor, PRIMITIVE_TYPES } from './DtoFieldExtractor';
import { Logger } from '../utils/Logger';
import { TextProcessor } from '../utils/TextProcessor';
import { AnnotationParser } from '../parsers/AnnotationParser';

interface ClassBlockSpan {
    className: string;
    declarationIndex: number;
    startIndex: number;
    endIndex: number;
}

interface DirectMethodSpan {
    methodName: string;
    className: string;
    classPath: string;
    annotations: string;
    signature: string;
    /** 0-based 起始行（含首个方法注解） */
    startLine: number;
    /** 0-based 方法声明行 */
    declarationLine: number;
    /** 0-based 结束行（方法体 `}` 或接口 `;`） */
    endLine: number;
    /** 上一个直接成员的 0-based 结束行，用于识别方法上方空行/注释间隙 */
    prevMemberEndLine: number;
}

export class ParameterExtractor {
    private static readonly javaModifiers = new Set([
        'public', 'private', 'protected', 'internal', 'static', 'final', 'abstract',
        'synchronized', 'default', 'native', 'open', 'override', 'suspend', 'inline',
        'operator', 'infix', 'tailrec', 'strictfp'
    ]);

    private springParser: SpringParameterParser;
    private jaxRsParser: JaxRsParameterParser;
    private dtoExtractor: DtoFieldExtractor;
    private logger: Logger;

    constructor() {
        this.springParser = new SpringParameterParser();
        this.jaxRsParser = new JaxRsParameterParser();
        this.dtoExtractor = new DtoFieldExtractor();
        this.logger = Logger.getInstance();
    }

    /**
     * 从当前编辑器文本提取端点参数，并复用索引解析器获取路由和 HTTP 方法。
     *
     * @param document 当前 Java 或 Kotlin 文档，包含尚未保存的编辑内容
     * @param position 光标位置，用于定位所属方法
     * @param options.expandDto 为 false 时跳过 DTO 递归展开（不触发文件 I/O），
     *        供复制 URL 等只需要路由与参数来源的命令使用
     * @returns 可复制的端点参数信息；光标不在受支持的方法上时返回 null
     */
    async extract(
        document: vscode.TextDocument,
        position: vscode.Position,
        options?: { expandDto?: boolean }
    ): Promise<EndpointCopyInfo | null> {
        const text = document.getText();
        const filePath = document.uri.fsPath;

        const framework = this.detectFramework(text);
        if (!framework) { return null; }

        const methodInfo = this.findMethodAtPosition(text, position.line, filePath.endsWith('.kt'));
        if (!methodInfo) { return null; }

        const parsed = new AnnotationParser().parseFileResult(text, filePath);
        const route = parsed.success
            ? parsed.endpoints
                .filter(endpoint => endpoint.className === methodInfo.className
                    && endpoint.methodName === methodInfo.methodName
                    && endpoint.line >= methodInfo.startLine + 1
                    && endpoint.line <= methodInfo.declarationLine + 1)
                .sort((left, right) => right.line - left.line)[0]
            : undefined;

        const parameters: EndpointParameter[] = framework === 'Spring'
            ? this.springParser.parseMethodParameters(methodInfo.signature)
            : this.jaxRsParser.parseMethodParameters(methodInfo.signature);

        const { httpMethod, contentType } = this.detectHttpAndContentType(methodInfo.annotations, framework, route?.method);

        const copyInfo: EndpointCopyInfo = {
            httpMethod,
            contentType,
            path: route?.path ?? methodInfo.fullPath,
            parameters,
            framework,
            dtoFields: new Map()
        };

        if (copyInfo.parameters.length > 0 && options?.expandDto !== false) {
            copyInfo.dtoFields = await this.resolveDtoFields(copyInfo.parameters, text);
        }

        return copyInfo;
    }

    /**
     * 为已提取的端点信息补充 DTO 字段展开，供需要按内容类型延迟展开的命令复用。
     */
    async expandDtoFields(copyInfo: EndpointCopyInfo, document: vscode.TextDocument): Promise<EndpointCopyInfo> {
        if (copyInfo.parameters.length === 0) { return copyInfo; }
        copyInfo.dtoFields = await this.resolveDtoFields(copyInfo.parameters, document.getText());
        return copyInfo;
    }

    private detectFramework(text: string): 'Spring' | 'JAX-RS' | null {
        if (/@(?:[\w$]+\.)*(?:Get|Post|Put|Delete|Patch)Mapping|@(?:[\w$]+\.)*RequestMapping|@(?:[\w$]+\.)*RequestParam|@(?:[\w$]+\.)*PathVariable|@(?:[\w$]+\.)*RequestBody/.test(text)) {
            return 'Spring';
        }
        if (/@(?:[\w$]+\.)*(?:GET|POST|PUT|DELETE|PATCH)\b|@(?:[\w$]+\.)*Path\b|@(?:[\w$]+\.)*PathParam|@(?:[\w$]+\.)*QueryParam|@(?:[\w$]+\.)*FormParam/.test(text)) {
            return 'JAX-RS';
        }
        if (/import\s+[\w.]*org\.springframework/.test(text)) { return 'Spring'; }
        if (/import\s+[\w.]*(?:javax|jakarta)\.ws\.rs/.test(text)) { return 'JAX-RS'; }
        return null;
    }

    private findMethodAtPosition(text: string, cursorLine: number, isKotlin: boolean): {
        signature: string;
        annotations: string;
        methodName: string;
        className: string;
        startLine: number;
        declarationLine: number;
        methodPath: string;
        classPath: string;
        fullPath: string;
    } | null {
        const sanitized = TextProcessor.sanitize(text, { rawTripleQuotes: isKotlin });
        const lineIndex = TextProcessor.buildLineIndex(text);
        const classBlocks = this.collectClassBlocks(sanitized);
        if (classBlocks.length === 0) {
            return null;
        }

        const directChildren = this.collectDirectChildren(classBlocks);

        // 选择包含 cursorLine 的最内层类型块
        let targetBlock: ClassBlockSpan | null = null;
        for (const block of classBlocks) {
            const startLine = TextProcessor.getLineNumber(lineIndex, block.startIndex) - 1;
            const endLine = TextProcessor.getLineNumber(lineIndex, Math.max(0, block.endIndex - 1)) - 1;
            if (cursorLine >= startLine && cursorLine <= endLine) {
                if (!targetBlock || (block.endIndex - block.startIndex) < (targetBlock.endIndex - targetBlock.startIndex)) {
                    targetBlock = block;
                }
            }
        }
        if (!targetBlock) {
            return null;
        }

        const children = directChildren.get(targetBlock) ?? [];
        const maskedSanitized = this.extractMaskedBlock(sanitized, targetBlock, children);
        const methods = this.collectDirectMethods(text, maskedSanitized, targetBlock, lineIndex);
        if (methods.length === 0) {
            return null;
        }

        const matched = methods.find(m => cursorLine >= m.startLine && cursorLine <= m.endLine)
            ?? methods.find(m => cursorLine > m.prevMemberEndLine && cursorLine < m.startLine);
        if (!matched) {
            return null;
        }

        const methodPath = this.extractPathFromAnnotations(matched.annotations);
        const fullPath = this.concatenatePaths(matched.classPath, methodPath);
        return {
            signature: matched.signature,
            annotations: matched.annotations,
            methodName: matched.methodName,
            className: matched.className,
            startLine: matched.startLine,
            declarationLine: matched.declarationLine,
            methodPath,
            classPath: matched.classPath,
            fullPath
        };
    }

    private collectDirectMethods(
        fullContent: string,
        maskedSanitized: string,
        block: ClassBlockSpan,
        lineIndex: number[]
    ): DirectMethodSpan[] {
        const methods: DirectMethodSpan[] = [];
        const relDeclIndex = block.declarationIndex - block.startIndex;
        const braceOffset = maskedSanitized.indexOf('{', relDeclIndex);
        if (braceOffset === -1) {
            return methods;
        }

        const classHeaderRaw = fullContent.substring(block.startIndex, block.startIndex + braceOffset);
        const classPath = this.extractPathFromAnnotationText(classHeaderRaw) || '';

        let index = braceOffset + 1;
        let memberStart = index;
        let prevMemberEndLine = TextProcessor.getLineNumber(lineIndex, block.startIndex + braceOffset) - 1;

        while (index < maskedSanitized.length) {
            const ch = maskedSanitized[index];
            if (/\s/.test(ch)) {
                index++;
                continue;
            }
            if (ch === '}') {
                break;
            }
            if (ch === ';') {
                prevMemberEndLine = TextProcessor.getLineNumber(lineIndex, block.startIndex + index) - 1;
                index++;
                memberStart = index;
                continue;
            }
            if (ch === '@') {
                index = this.skipAnnotation(maskedSanitized, index);
                continue;
            }
            if (ch === '{') {
                index = this.skipBraceBlock(maskedSanitized, index);
                prevMemberEndLine = TextProcessor.getLineNumber(lineIndex, block.startIndex + Math.max(0, index - 1)) - 1;
                memberStart = index;
                continue;
            }

            const declarationOffset = index;
            const openParenOffset = this.findMethodOpenParen(maskedSanitized, declarationOffset);
            if (openParenOffset === -1) {
                index = Math.max(this.skipToMemberBoundary(maskedSanitized, declarationOffset), declarationOffset + 1);
                prevMemberEndLine = TextProcessor.getLineNumber(lineIndex, block.startIndex + Math.max(0, index - 1)) - 1;
                memberStart = index;
                continue;
            }

            const closeParenOffset = this.findMatchingParen(maskedSanitized, openParenOffset);
            if (closeParenOffset === -1) {
                break;
            }

            const terminator = this.findMethodTerminator(maskedSanitized, closeParenOffset + 1);
            if (terminator.kind === 'other') {
                index = Math.max(this.skipToMemberBoundary(maskedSanitized, terminator.index), closeParenOffset + 1);
                prevMemberEndLine = TextProcessor.getLineNumber(lineIndex, block.startIndex + Math.max(0, index - 1)) - 1;
                memberStart = index;
                continue;
            }

            const methodEndOffset = terminator.endOffset;
            const prefix = maskedSanitized.substring(declarationOffset, openParenOffset);
            const nameMatch = prefix.match(/([A-Za-z_$][\w$]*)\s*$/);
            const methodName = nameMatch ? nameMatch[1] : null;

            if (methodName && !this.isConstructorDeclaration(prefix, methodName, block.className)) {
                let firstAnnotationOffset = declarationOffset;
                for (let cursor = memberStart; cursor < declarationOffset; cursor++) {
                    if (maskedSanitized[cursor] === '@') {
                        firstAnnotationOffset = cursor;
                        break;
                    }
                }

                const absAnnStart = block.startIndex + firstAnnotationOffset;
                const absDecl = block.startIndex + declarationOffset;
                const absOpenParen = block.startIndex + openParenOffset;
                const absCloseParen = block.startIndex + closeParenOffset;
                const absEnd = block.startIndex + Math.max(firstAnnotationOffset, methodEndOffset - 1);

                const annotations = fullContent.substring(absAnnStart, absDecl).trim();
                const paramSection = fullContent.substring(absOpenParen + 1, absCloseParen);
                methods.push({
                    methodName,
                    className: block.className,
                    classPath,
                    annotations,
                    signature: `${methodName}(${paramSection})`,
                    startLine: TextProcessor.getLineNumber(lineIndex, absAnnStart) - 1,
                    declarationLine: TextProcessor.getLineNumber(lineIndex, absDecl) - 1,
                    endLine: TextProcessor.getLineNumber(lineIndex, absEnd) - 1,
                    prevMemberEndLine
                });
            }

            prevMemberEndLine = TextProcessor.getLineNumber(lineIndex, block.startIndex + Math.max(0, methodEndOffset - 1)) - 1;
            index = methodEndOffset;
            memberStart = index;
        }

        return methods;
    }

    private isConstructorDeclaration(prefix: string, methodName: string, className: string): boolean {
        if (methodName === 'constructor') {
            return true;
        }
        if (methodName !== className || /\bfun\b/.test(prefix)) {
            return false;
        }
        // 剥离行内注解与修饰符后若只剩类名本身（无返回类型），则是 Java 构造器
        let stripped = '';
        let i = 0;
        while (i < prefix.length) {
            if (prefix[i] === '@') {
                i = this.skipAnnotation(prefix, i);
                continue;
            }
            stripped += prefix[i++];
        }
        const tokens = stripped.trim().split(/\s+/).filter(token => !ParameterExtractor.javaModifiers.has(token));
        return tokens.length === 1 && tokens[0] === className;
    }

    private findMethodOpenParen(sanitized: string, from: number): number {
        let angleDepth = 0;
        let i = from;
        while (i < sanitized.length) {
            const ch = sanitized[i];
            if (ch === '@') {
                i = this.skipAnnotation(sanitized, i);
                continue;
            }
            if (ch === '<') {
                angleDepth++;
                i++;
                continue;
            }
            if (ch === '>' && angleDepth > 0) {
                angleDepth--;
                i++;
                continue;
            }
            if (angleDepth === 0) {
                if (ch === '(') {
                    return i;
                }
                if (ch === '=' || ch === ';' || ch === '{' || ch === '}') {
                    return -1;
                }
            }
            i++;
        }
        return -1;
    }

    private findMethodTerminator(
        sanitized: string,
        from: number
    ): { kind: 'body' | 'semicolon'; endOffset: number } | { kind: 'other'; index: number } {
        let angleDepth = 0;
        let i = from;
        while (i < sanitized.length) {
            const ch = sanitized[i];
            if (ch === '@') {
                i = this.skipAnnotation(sanitized, i);
                continue;
            }
            if (ch === '<') {
                angleDepth++;
                i++;
                continue;
            }
            if (ch === '>' && angleDepth > 0) {
                angleDepth--;
                i++;
                continue;
            }
            if (angleDepth === 0) {
                if (ch === '{') {
                    return { kind: 'body', endOffset: this.skipBraceBlock(sanitized, i) };
                }
                if (ch === ';') {
                    return { kind: 'semicolon', endOffset: i + 1 };
                }
                if (!/[\w\s.,[\]&:?]/.test(ch)) {
                    return { kind: 'other', index: i };
                }
            }
            i++;
        }
        return { kind: 'other', index: sanitized.length };
    }

    private collectClassBlocks(sanitized: string): ClassBlockSpan[] {
        const blocks: ClassBlockSpan[] = [];
        const classPattern = /\b(class|interface|object)\s+(\w+)/g;
        let match: RegExpExecArray | null;
        while ((match = classPattern.exec(sanitized)) !== null) {
            const actualStart = this.findDeclarationStart(sanitized, match.index);
            const firstBrace = sanitized.indexOf('{', match.index);
            if (firstBrace === -1) {
                continue;
            }
            const endIndex = this.skipBraceBlock(sanitized, firstBrace);
            if (endIndex <= firstBrace) {
                continue;
            }
            blocks.push({
                className: match[2],
                declarationIndex: match.index,
                startIndex: actualStart,
                endIndex
            });
        }
        return blocks;
    }

    private collectDirectChildren(classBlocks: ClassBlockSpan[]): Map<ClassBlockSpan, ClassBlockSpan[]> {
        const sorted = [...classBlocks].sort((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex);
        const directChildren = new Map<ClassBlockSpan, ClassBlockSpan[]>();
        const stack: ClassBlockSpan[] = [];

        for (const block of sorted) {
            while (stack.length > 0 && stack[stack.length - 1].endIndex <= block.startIndex) {
                stack.pop();
            }
            const parent = stack[stack.length - 1];
            if (parent) {
                const list = directChildren.get(parent);
                if (list) {
                    list.push(block);
                } else {
                    directChildren.set(parent, [block]);
                }
            }
            stack.push(block);
        }
        return directChildren;
    }

    private extractMaskedBlock(sanitized: string, block: ClassBlockSpan, children: ClassBlockSpan[]): string {
        const slice = sanitized.substring(block.startIndex, block.endIndex);
        if (children.length === 0) {
            return slice;
        }
        const chars = slice.split('');
        for (const child of children) {
            const start = Math.max(0, child.startIndex - block.startIndex);
            const end = Math.min(chars.length, child.endIndex - block.startIndex);
            for (let i = start; i < end; i++) {
                if (chars[i] !== '\n' && chars[i] !== '\r') {
                    chars[i] = ' ';
                }
            }
        }
        return chars.join('');
    }

    private findDeclarationStart(sanitized: string, declarationIndex: number): number {
        let parenDepth = 0;
        let bracketDepth = 0;
        for (let i = declarationIndex - 1; i >= 0; i--) {
            const ch = sanitized[i];
            if (ch === ')') { parenDepth++; }
            else if (ch === '(' && parenDepth > 0) { parenDepth--; }
            else if (ch === ']') { bracketDepth++; }
            else if (ch === '[' && bracketDepth > 0) { bracketDepth--; }
            else if (parenDepth === 0 && bracketDepth === 0 && (ch === ';' || ch === '{' || ch === '}')) {
                return i + 1;
            }
        }
        return 0;
    }

    private skipAnnotation(sanitized: string, atIndex: number): number {
        let i = atIndex + 1;
        while (i < sanitized.length && /[\w.:$]/.test(sanitized[i])) {
            i++;
        }
        while (i < sanitized.length && /\s/.test(sanitized[i])) {
            i++;
        }
        if (sanitized[i] === '(') {
            const close = this.findMatchingParen(sanitized, i);
            if (close !== -1) {
                return close + 1;
            }
        }
        return i;
    }

    private findMatchingParen(sanitized: string, openIndex: number): number {
        let depth = 0;
        for (let i = openIndex; i < sanitized.length; i++) {
            if (sanitized[i] === '(') { depth++; }
            else if (sanitized[i] === ')') {
                depth--;
                if (depth === 0) { return i; }
            }
        }
        return -1;
    }

    private skipBraceBlock(sanitized: string, openIndex: number): number {
        let depth = 0;
        for (let i = openIndex; i < sanitized.length; i++) {
            if (sanitized[i] === '{') { depth++; }
            else if (sanitized[i] === '}') {
                depth--;
                if (depth === 0) { return i + 1; }
            }
        }
        return sanitized.length;
    }

    private skipToMemberBoundary(sanitized: string, from: number): number {
        let parenDepth = 0;
        let braceDepth = 0;
        for (let i = from; i < sanitized.length; i++) {
            const ch = sanitized[i];
            if (ch === '(') { parenDepth++; }
            else if (ch === ')') { parenDepth--; }
            else if (ch === '{') {
                if (parenDepth === 0 && braceDepth === 0) { return i; }
                braceDepth++;
            } else if (ch === '}') {
                if (braceDepth === 0) { return i; }
                braceDepth--;
            } else if ((ch === ';' || ch === '@' || ch === '\n') && parenDepth === 0 && braceDepth === 0) {
                return ch === ';' ? i + 1 : i;
            }
        }
        return sanitized.length;
    }

    private concatenatePaths(classPath: string, methodPath: string): string {
        if (!classPath) { return methodPath; }
        if (!methodPath) { return classPath; }

        const base = classPath.endsWith('/') ? classPath.slice(0, -1) : classPath;
        const suffix = methodPath.startsWith('/') ? methodPath.slice(1) : methodPath;
        return `${base}/${suffix}`;
    }

    private extractPathFromAnnotations(annotations: string): string {
        return this.extractPathFromAnnotationText(annotations) || '';
    }

    /**
     * 从 Spring/JAX-RS 路由注解中提取复制命令使用的路径。
     *
     * 当 Spring mapping 同时声明多个路径时，复制 URL/cURL 命令稳定使用源码中的
     * 第一个路径；完整端点扫描仍由解析器拆分全部路径，不受此规则影响。
     */
    private extractPathFromAnnotationText(annotationText: string): string | null {
        const jaxRsPath = annotationText.match(/@(?:[\w.]+\.)?Path\s*\(\s*["']([^"']+)["']/);
        if (jaxRsPath) { return jaxRsPath[1]; }

        const mappingMatch = annotationText.match(/@(?:[\w.]+\.)?(?:Request|Get|Post|Put|Delete|Patch)Mapping\s*\(([\s\S]*)\)/);
        if (!mappingMatch) { return null; }

        const args = mappingMatch[1];
        const explicitPath = args.match(/(?:^|,)\s*(?:value|path)\s*=\s*(?:\{\s*)?["']([^"']+)["']/);
        if (explicitPath) { return explicitPath[1]; }

        const directPath = args.match(/^\s*(?:\{\s*)?["']([^"']+)["']/);
        return directPath ? directPath[1] : null;
    }

    private detectHttpAndContentType(annotations: string, framework: string, parsedMethod?: string): {
        httpMethod: string;
        contentType: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'url-params';
    } {
        let httpMethod = 'GET';

        if (parsedMethod) {
            httpMethod = parsedMethod;
        } else if (framework === 'Spring') {
            httpMethod = this.detectSpringHttpMethod(annotations);
        } else {
            if (/@POST\b/.test(annotations)) { httpMethod = 'POST'; }
            else if (/@PUT\b/.test(annotations)) { httpMethod = 'PUT'; }
            else if (/@DELETE\b/.test(annotations)) { httpMethod = 'DELETE'; }
            else if (/@PATCH\b/.test(annotations)) { httpMethod = 'PATCH'; }
        }

        if (/consumes\s*=\s*(?:\{\s*)?MediaType\.MULTIPART_FORM_DATA_VALUE|multipart\/form-data/.test(annotations)) {
            return { httpMethod, contentType: 'form-data' };
        }
        if (/consumes\s*=\s*(?:\{\s*)?MediaType\.APPLICATION_FORM_URLENCODED_VALUE|application\/x-www-form-urlencoded/.test(annotations)) {
            return { httpMethod, contentType: 'x-www-form-urlencoded' };
        }
        if (/@RequestBody/.test(annotations)) {
            return { httpMethod, contentType: 'json' };
        }
        if (/consumes\s*=\s*(?:\{\s*)?MediaType\.APPLICATION_JSON_VALUE|application\/json/.test(annotations)) {
            return { httpMethod, contentType: 'json' };
        }

        if (httpMethod === 'GET' || httpMethod === 'DELETE') {
            return { httpMethod, contentType: 'url-params' };
        }
        return { httpMethod, contentType: 'json' };
    }

    private detectSpringHttpMethod(annotations: string): string {
        if (/@(?:[\w.]+\.)?PostMapping\b/.test(annotations)) { return 'POST'; }
        if (/@(?:[\w.]+\.)?PutMapping\b/.test(annotations)) { return 'PUT'; }
        if (/@(?:[\w.]+\.)?DeleteMapping\b/.test(annotations)) { return 'DELETE'; }
        if (/@(?:[\w.]+\.)?PatchMapping\b/.test(annotations)) { return 'PATCH'; }
        if (/@(?:[\w.]+\.)?GetMapping\b/.test(annotations)) { return 'GET'; }

        const methodAttr = annotations.match(/(?:^|,|\()\s*method\s*=\s*(?:\{([\s\S]*?)\}|([^,)]+))/);
        if (!methodAttr) { return 'GET'; }

        const rawValue = methodAttr[1] || methodAttr[2] || '';
        const methodMatch = rawValue.match(/(?:RequestMethod\.)?(GET|POST|PUT|DELETE|PATCH)\b/);
        return methodMatch ? methodMatch[1] : 'GET';
    }

    /**
     * 为 @RequestBody 和 @ModelAttribute 参数解析 DTO 字段。
     */
    private async resolveDtoFields(parameters: EndpointParameter[], documentText: string): Promise<Map<string, import('../models/types').DtoField[]>> {
        const dtoFields = new Map<string, import('../models/types').DtoField[]>();

        for (const param of parameters) {
            if ((param.source === 'body' || param.source === 'form') && param.type && !this.isPrimitiveType(param.type)) {
                const typeName = param.type;
                const potentialFQNs = TextProcessor.buildPotentialFQNs(documentText, typeName);

                const fields = await this.dtoExtractor.findDtoFields(typeName, new Set(), 0, potentialFQNs);
                if (fields.length > 0) {
                    dtoFields.set(typeName, fields);
                }
            }
        }

        return dtoFields;
    }

    private isPrimitiveType(type: string): boolean {
        const base = type.replace(/(?:\[\]|\?)+$/, '').trim();
        return PRIMITIVE_TYPES.includes(type) || PRIMITIVE_TYPES.includes(base);
    }
}
