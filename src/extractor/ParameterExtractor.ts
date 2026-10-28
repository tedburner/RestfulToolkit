import * as vscode from 'vscode';
import { EndpointCopyInfo, EndpointParameter } from '../models/types';
import { SpringParameterParser } from './SpringParameterParser';
import { JaxRsParameterParser } from './JaxRsParameterParser';
import { DtoFieldExtractor, PRIMITIVE_TYPES } from './DtoFieldExtractor';
import { Logger } from '../utils/Logger';
import { TextProcessor } from '../utils/TextProcessor';
import { AnnotationParser } from '../parsers/AnnotationParser';

export class ParameterExtractor {
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

        // 检测框架
        const framework = this.detectFramework(text);
        if (!framework) { return null; }

        // 查找光标所在方法
        const methodInfo = this.findMethodAtPosition(text, position.line);
        if (!methodInfo) { return null; }
        const parsed = new AnnotationParser().parseFileResult(text, document.uri.fsPath);
        const route = parsed.success
            ? parsed.endpoints
                .filter(endpoint => endpoint.className === methodInfo.className
                    && endpoint.methodName === methodInfo.methodName
                    && endpoint.line <= methodInfo.declarationLine + 1)
                .sort((left, right) => right.line - left.line)[0]
            : undefined;

        // 解析参数
        let parameters: EndpointParameter[];
        if (framework === 'Spring') {
            parameters = this.springParser.parseMethodParameters(methodInfo.signature);
        } else {
            parameters = this.jaxRsParser.parseMethodParameters(methodInfo.signature);
        }

        // 检测 HTTP 方法和内容类型
        const { httpMethod, contentType } = this.detectHttpAndContentType(methodInfo.annotations, framework, route?.method);

        const copyInfo: EndpointCopyInfo = {
            httpMethod,
            contentType,
            path: route?.path ?? methodInfo.fullPath,
            parameters,
            framework,
            dtoFields: new Map()
        };

        // 无参数时无需展开 DTO；expandDto 为 false 时不触发 DTO 文件 I/O
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
        // 检查 Spring 注解
        if (/@(Get|Post|Put|Delete|Patch)Mapping|@RequestMapping|@RequestParam|@PathVariable|@RequestBody/.test(text)) {
            return 'Spring';
        }
        // 检查 JAX-RS 注解
        if (/@(GET|POST|PUT|DELETE|PATCH)\b|@Path\b|@PathParam|@QueryParam|@FormParam/.test(text)) {
            return 'JAX-RS';
        }
        // 检查 import
        if (/import.*org\.springframework/.test(text)) { return 'Spring'; }
        if (/import.*javax\.ws\.rs|import.*jakarta\.ws\.rs/.test(text)) { return 'JAX-RS'; }
        return null;
    }

    private findMethodAtPosition(text: string, cursorLine: number): {
        signature: string;
        annotations: string;
        methodName: string;
        className: string;
        declarationLine: number;
        methodPath: string;
        classPath: string;
        fullPath: string;
    } | null {
        const lines = text.split('\n');
        const sanitizedText = TextProcessor.sanitize(text);
        const sanitizedLines = sanitizedText.split('\n');

        // Step 1: 找方法声明行。在净化后的内容上做大括号深度计算与扫描。
        let declLine = -1;
        let braceDepth = 0;
        for (let i = cursorLine; i >= 0; i--) {
            const line = sanitizedLines[i].trim();
            if (this.isMethodDeclaration(line)) {
                declLine = i;
                break;
            }
            if (line === '') { continue; }
            if (line.startsWith('@')) { continue; }
            if (line.startsWith('{') || line.endsWith('{') || line.startsWith('return ') || line.startsWith('throw ')) {
                braceDepth++;
                continue;
            }
            if (line === '}' || line.startsWith('} ')) {
                if (braceDepth > 0) { braceDepth--; continue; }
                break;
            }
        }

        // 策略 B: 向后扫描
        if (declLine === -1) {
            for (let i = cursorLine; i < sanitizedLines.length; i++) {
                const line = sanitizedLines[i].trim();
                if (this.isMethodDeclaration(line)) {
                    declLine = i;
                    break;
                }
                // 遇到 } 说明已经越过当前方法区域，停止
                if (line === '}' || line.startsWith('} ')) { break; }
                if (line.startsWith('{')) { break; }
            }
        }
        if (declLine === -1) { return null; }

        // Step 2: 从声明行向前找注解行
        const annotationLines: string[] = [];
        for (let i = declLine - 1; i >= 0; i--) {
            const line = lines[i].trim();
            const sanitizedLine = sanitizedLines[i].trim();
            if (sanitizedLine.startsWith('@')) {
                annotationLines.unshift(line);
            } else if (sanitizedLine.length > 0) {
                break; // 非空非注解行，停止
            }
            // 空行跳过
        }

        // Step 3: 结构化定位参数区。括号深度在净化内容上计算（防字符串/注释干扰），
        // 但截取使用原文绝对偏移，mapping 注解不会进入参数区。
        const lineStartOffsets: number[] = new Array(lines.length);
        {
            let offset = 0;
            for (let i = 0; i < lines.length; i++) {
                lineStartOffsets[i] = offset;
                offset += lines[i].length + 1;
            }
        }

        let firstParenOffset = -1;
        let closeParenOffset = -1;
        let parenDepth = 0;
        scan:
        for (let j = declLine; j < lines.length; j++) {
            const sanitizedLine = sanitizedLines[j];
            const lineStart = lineStartOffsets[j];
            for (let k = 0; k < sanitizedLine.length; k++) {
                const ch = sanitizedLine[k];
                if (ch === '(') {
                    if (firstParenOffset === -1) { firstParenOffset = lineStart + k; }
                    parenDepth++;
                } else if (ch === ')') {
                    parenDepth--;
                    if (firstParenOffset !== -1 && parenDepth === 0) {
                        closeParenOffset = lineStart + k;
                        break scan;
                    }
                }
            }
        }
        if (firstParenOffset === -1 || closeParenOffset === -1) { return null; }

        const declarationPrefix = text.substring(lineStartOffsets[declLine], firstParenOffset);
        const methodNameMatch = declarationPrefix.match(/([A-Za-z_$][\w$]*)\s*$/);
        if (!methodNameMatch) { return null; }
        const methodName = methodNameMatch[1];

        // 仅传方法名 + 参数区给参数解析器，避免把路由注解也拼入“签名”
        const paramSection = text.substring(firstParenOffset + 1, closeParenOffset);
        const signature = `${methodName}(${paramSection})`;

        const methodPath = this.extractPathFromAnnotations(annotationLines.join('\n'));
        const classPath = this.findClassLevelPath(lines, declLine);
        const fullPath = this.concatenatePaths(classPath, methodPath);
        return {
            signature,
            annotations: annotationLines.join('\n'),
            methodName,
            className: this.findClassName(lines, declLine),
            declarationLine: declLine,
            methodPath,
            classPath,
            fullPath
        };
    }

    private isMethodDeclaration(line: string): boolean {
        const trimmed = line.trim();
        return /^(?:(?:public|private|protected|static|final|abstract|synchronized|override|suspend)\s+)*(?:fun\s+\w+|(?:[\w.$<>?,]+\s+)+\w+)\s*\(/.test(trimmed);
    }

    private findClassName(lines: string[], methodDeclLine: number): string {
        for (let index = methodDeclLine - 1; index >= 0; index--) {
            const match = lines[index].match(/\b(?:class|interface|object)\s+(\w+)/);
            if (match) { return match[1]; }
        }
        return '';
    }

    /**
     * 向前搜索类级别的 @RequestMapping / @Path 注解
     */
    private findClassLevelPath(lines: string[], methodDeclLine: number): string {
        // 向前找类声明行（class 或 object 关键字）
        let classLine = -1;
        for (let i = methodDeclLine - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (/\b(class|object)\b/.test(line)) {
                classLine = i;
                break;
            }
            // 遇到 package 或 import 语句，停止
            if (/^(package|import)\b/.test(line)) { break; }
        }
        if (classLine === -1) { return ''; }

        // 从类声明行向前找注解
        for (let i = classLine - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('@')) {
                const path = this.extractClassPath(line);
                if (path) { return path; }
            } else if (line.length > 0 && !line.startsWith('@')) {
                // 非注解非空行，停止
                break;
            }
        }

        return '';
    }

    /**
     * 从单行注解中提取路径
     */
    private extractClassPath(annotationLine: string): string | null {
        return this.extractPathFromAnnotationText(annotationLine);
    }

    /**
     * 拼接类级路径和方法级路径，去除重复斜杠
     */
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
     *
     * @param annotationText 方法或类型声明前的注解文本
     * @returns 首个可用路径；未找到受支持路由注解时返回 null
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

        // 从 consumes 属性检测内容类型
        if (/consumes\s*=\s*MediaType\.MULTIPART_FORM_DATA_VALUE|multipart\/form-data/.test(annotations)) {
            return { httpMethod, contentType: 'form-data' };
        }
        if (/consumes\s*=\s*MediaType\.APPLICATION_FORM_URLENCODED_VALUE|application\/x-www-form-urlencoded/.test(annotations)) {
            return { httpMethod, contentType: 'x-www-form-urlencoded' };
        }
        if (/@RequestBody/.test(annotations)) {
            return { httpMethod, contentType: 'json' };
        }
        if (/consumes\s*=\s*MediaType\.APPLICATION_JSON_VALUE|application\/json/.test(annotations)) {
            return { httpMethod, contentType: 'json' };
        }

        // 按 HTTP 方法默认
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

    /**
     * 判断是否为基本类型（无需展开 DTO）。
     */
    private isPrimitiveType(type: string): boolean {
        return PRIMITIVE_TYPES.includes(type);
    }
}
