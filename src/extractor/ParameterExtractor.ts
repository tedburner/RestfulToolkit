import * as vscode from 'vscode';
import { EndpointCopyInfo, EndpointParameter } from '../models/types';
import { SpringParameterParser } from './SpringParameterParser';
import { JaxRsParameterParser } from './JaxRsParameterParser';
import { DtoFieldExtractor, PRIMITIVE_TYPES } from './DtoFieldExtractor';
import { Logger } from '../utils/Logger';

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

    async extract(document: vscode.TextDocument, position: vscode.Position): Promise<EndpointCopyInfo | null> {
        const text = document.getText();

        // 检测框架
        const framework = this.detectFramework(text);
        if (!framework) { return null; }

        // 查找光标所在方法
        const methodInfo = this.findMethodAtPosition(text, position.line);
        if (!methodInfo) { return null; }

        // 解析参数
        let parameters: EndpointParameter[];
        if (framework === 'Spring') {
            parameters = this.springParser.parseMethodParameters(methodInfo.signature);
        } else {
            parameters = this.jaxRsParser.parseMethodParameters(methodInfo.signature);
        }

        // 无参数时仍可提取端点信息（用于 Copy URL / cURL）
        if (parameters.length === 0) {
            // 解析 @RequestBody 参数的 DTO 字段
            const dtoFields = await this.resolveDtoFields(parameters);

            const { httpMethod, contentType } = this.detectHttpAndContentType(methodInfo.annotations, framework);

            return {
                httpMethod,
                contentType,
                path: methodInfo.fullPath,
                parameters: [],
                framework,
                dtoFields
            };
        }

        // 检测 HTTP 方法和内容类型
        const { httpMethod, contentType } = this.detectHttpAndContentType(methodInfo.annotations, framework);

        // 解析 @RequestBody 参数的 DTO 字段
        const dtoFields = await this.resolveDtoFields(parameters);

        return {
            httpMethod,
            contentType,
            path: methodInfo.fullPath,
            parameters,
            framework,
            dtoFields
        };
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
        methodPath: string;
        classPath: string;
        fullPath: string;
    } | null {
        const lines = text.split('\n');

        // Step 1: 找方法声明行。策略 A 向前扫描，策略 B 向后扫描作为兜底。
        let declLine = -1;
        let braceDepth = 0;
        for (let i = cursorLine; i >= 0; i--) {
            const line = lines[i].trim();
            if (/\b(public|private|protected)\b/.test(line)) {
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
            for (let i = cursorLine; i < lines.length; i++) {
                const line = lines[i].trim();
                if (/\b(public|private|protected)\b/.test(line)) {
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
            if (line.startsWith('@')) {
                annotationLines.unshift(line);
            } else if (line.length > 0) {
                break; // 非空非注解行，停止
            }
            // 空行跳过
        }

        // Step 3: 从声明行向后收集完整方法签名（括号深度匹配）
        let sigText = '';
        let parenDepth = 0;
        let foundOpenParen = false;
        for (let j = declLine; j < lines.length; j++) {
            sigText += (sigText ? '\n' : '') + lines[j];
            for (const ch of lines[j]) {
                if (ch === '(') { parenDepth++; foundOpenParen = true; }
                else if (ch === ')') {
                    parenDepth--;
                    if (foundOpenParen && parenDepth === 0) {
                        // 找到方法参数的闭合 ')'，截取到此位置
                        const matchEnd = sigText.lastIndexOf(')') + 1;
                        const sigUpToClose = sigText.substring(0, matchEnd);
                        const methodMatch = sigUpToClose.match(/((?:public|private|protected)[^{]*\)\s*)/s);
                        if (methodMatch) {
                            const methodPath = this.extractPathFromAnnotations(annotationLines.join('\n'));
                            const classPath = this.findClassLevelPath(lines, declLine);
                            const fullPath = this.concatenatePaths(classPath, methodPath);
                            return {
                                signature: [...annotationLines, methodMatch[1]].join('\n'),
                                annotations: annotationLines.join('\n'),
                                methodPath,
                                classPath,
                                fullPath
                            };
                        }
                        return null;
                    }
                }
            }
        }

        return null;
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
        const patterns = [
            /@(?:Request|Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"/,
            /@Path\s*\(\s*"([^"]+)"/,
        ];
        for (const pattern of patterns) {
            const match = annotationLine.match(pattern);
            if (match) { return match[1]; }
        }
        return null;
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
        const patterns = [
            /@(?:Request|Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"/,
            /@Path\s*\(\s*"([^"]+)"/,
        ];
        for (const pattern of patterns) {
            const match = annotations.match(pattern);
            if (match) { return match[1]; }
        }
        return '';
    }

    private detectHttpAndContentType(annotations: string, framework: string): {
        httpMethod: string;
        contentType: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'url-params';
    } {
        let httpMethod = 'GET';

        if (framework === 'Spring') {
            if (/@PostMapping|method\s*=\s*RequestMethod\.POST/.test(annotations)) { httpMethod = 'POST'; }
            else if (/@PutMapping|method\s*=\s*RequestMethod\.PUT/.test(annotations)) { httpMethod = 'PUT'; }
            else if (/@DeleteMapping|method\s*=\s*RequestMethod\.DELETE/.test(annotations)) { httpMethod = 'DELETE'; }
            else if (/@PatchMapping|method\s*=\s*RequestMethod\.PATCH/.test(annotations)) { httpMethod = 'PATCH'; }
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

    /**
     * 为 @RequestBody 和 @ModelAttribute 参数解析 DTO 字段。
     */
    private async resolveDtoFields(parameters: EndpointParameter[]): Promise<Map<string, import('../models/types').DtoField[]>> {
        const dtoFields = new Map<string, import('../models/types').DtoField[]>();

        for (const param of parameters) {
            if ((param.source === 'body' || param.source === 'form') && param.type && !this.isPrimitiveType(param.type)) {
                const fields = await this.dtoExtractor.findDtoFields(param.type);
                if (fields.length > 0) {
                    dtoFields.set(param.type, fields);
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
