import * as vscode from 'vscode';
import { EndpointCopyInfo, EndpointParameter } from '../models/types';
import { SpringParameterParser } from './SpringParameterParser';
import { JaxRsParameterParser } from './JaxRsParameterParser';
import { DtoFieldExtractor } from './DtoFieldExtractor';
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

        if (parameters.length === 0) { return null; }

        // 检测 HTTP 方法和内容类型
        const { httpMethod, contentType } = this.detectHttpAndContentType(methodInfo.annotations, framework);

        // 解析 @RequestBody 参数的 DTO 字段
        const dtoFields = await this.resolveDtoFields(parameters);

        return {
            httpMethod,
            contentType,
            path: methodInfo.path || '',
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
        path: string;
    } | null {
        const lines = text.split('\n');

        let methodStartLine = -1;
        const methodSignatureLines: string[] = [];
        const annotationLines: string[] = [];

        // 从光标位置向前搜索方法签名
        for (let i = cursorLine; i >= 0; i--) {
            const line = lines[i].trim();

            if (line.includes('(') && /\b(public|private|protected)\b/.test(line)) {
                methodStartLine = i;
                // 收集完整方法签名（可能跨行）
                let sigText = '';
                for (let j = i; j < lines.length; j++) {
                    sigText += lines[j];
                    if (lines[j].includes(')')) {
                        const methodMatch = sigText.match(/((?:public|private|protected)[^{]*\)\s*)\{?/s);
                        if (methodMatch) {
                            methodSignatureLines.push(methodMatch[1]);
                        }
                        break;
                    }
                }
                break;
            }

            if (line.startsWith('@')) {
                annotationLines.unshift(line);
            }

            // 遇到闭合大括号说明到了上一个方法，停止
            if (line === '}' || line.startsWith('} ')) { break; }
        }

        if (methodStartLine === -1) { return null; }

        const fullSignature = [...annotationLines, ...methodSignatureLines].join('\n');
        const annotations = annotationLines.join('\n');
        const path = this.extractPathFromAnnotations(annotations);

        return {
            signature: fullSignature,
            annotations,
            path
        };
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
     * 为 @RequestBody 参数解析 DTO 字段。
     */
    private async resolveDtoFields(parameters: EndpointParameter[]): Promise<Map<string, import('../models/types').DtoField[]>> {
        const dtoFields = new Map<string, import('../models/types').DtoField[]>();

        for (const param of parameters) {
            if (param.source === 'body' && param.type && !this.isPrimitiveType(param.type)) {
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
        const primitives = [
            'String', 'Integer', 'Long', 'Short', 'Byte', 'Float', 'Double',
            'Boolean', 'int', 'long', 'short', 'byte', 'float', 'double',
            'boolean', 'char', 'Character', 'BigDecimal', 'BigInteger',
            'Date', 'LocalDate', 'LocalDateTime', 'ZonedDateTime',
            'MultipartFile', 'File', 'InputStream', 'byte[]'
        ];
        return primitives.includes(type);
    }
}
