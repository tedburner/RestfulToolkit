import { RestEndpoint } from '../models/types';
import { SpringMvcParser } from './SpringMvcParser';
import { JaxRsParser } from './JaxRsParser';
import { Logger } from '../utils/Logger';
import { TextProcessor } from '../utils/TextProcessor';

export class AnnotationParser {
    private springMvcParser: SpringMvcParser;
    private jaxRsParser: JaxRsParser;
    private logger: Logger;

    constructor() {
        this.springMvcParser = new SpringMvcParser();
        this.jaxRsParser = new JaxRsParser();
        this.logger = Logger.getInstance();
    }

    parseFile(content: string, filePath: string): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        try {
            if (filePath.endsWith('.kt')) {
                content = this.preprocessKotlin(content);
            }

            const sanitized = TextProcessor.sanitize(content);
            const lineIndex = TextProcessor.buildLineIndex(content);

            const classPattern = /(class|interface)\s+(\w+)/g;
            let classMatch;

            while ((classMatch = classPattern.exec(sanitized)) !== null) {
                const className = classMatch[2];
                const classStartIndex = classMatch.index;

                const blockRange = this.extractClassBlock(sanitized, classStartIndex);
                if (!blockRange) {
                    continue;
                }

                const classBlock = content.substring(blockRange.startIndex, blockRange.endIndex);
                const classBlockSanitized = sanitized.substring(blockRange.startIndex, blockRange.endIndex);

                const classBlockStartLine = TextProcessor.getLineNumber(lineIndex, blockRange.startIndex);
                const classBlockLineIndex = TextProcessor.buildLineIndex(classBlock);

                const springEndpoints = this.parseSpringMvc(classBlock, className, filePath, classBlockStartLine, classBlockLineIndex);
                const jaxRsEndpoints = this.parseJaxRs(classBlock, classBlockSanitized, className, filePath, classBlockStartLine, classBlockLineIndex);

                endpoints.push(...springEndpoints, ...jaxRsEndpoints);
            }

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Parse failed: ${filePath}`, err);
        }

        return endpoints;
    }

    private parseSpringMvc(content: string, className: string, filePath: string, classBlockStartLine: number, classBlockLineIndex: number[]): RestEndpoint[] {
        try {
            const classPath = this.springMvcParser.parseClassLevelPath(content);
            const endpoints = this.springMvcParser.parseMethodAnnotations(content, className, classPath, filePath, classBlockLineIndex);
            this.adjustLineNumbers(endpoints, classBlockStartLine);

            if (classPath && endpoints.length > 0) {
                this.logger.info(`Class ${className}: @RequestMapping("${classPath}") → ${endpoints.length} endpoints`);
            }

            return endpoints;
        } catch (error) {
            return [];
        }
    }

    private parseJaxRs(content: string, sanitizedContent: string, className: string, filePath: string, classBlockStartLine: number, classBlockLineIndex: number[]): RestEndpoint[] {
        try {
            const classPath = this.jaxRsParser.parseClassLevelPath(content);
            const endpoints = this.jaxRsParser.parseMethodAnnotations(content, sanitizedContent, className, classPath, filePath, classBlockLineIndex);
            this.adjustLineNumbers(endpoints, classBlockStartLine);

            return endpoints;
        } catch (error) {
            const err = error as Error;
            this.logger.warning(`JAX-RS parsing failed for class ${className} in ${filePath}: ${err.message}`);
            return [];
        }
    }

    private adjustLineNumbers(endpoints: RestEndpoint[], offset: number): void {
        endpoints.forEach(ep => {
            ep.line = offset + ep.line - 1;
        });
    }

    private preprocessKotlin(content: string): string {
        let processed = content;

        processed = processed.replace(/@(\w+)"([^"]+)"/g, '@$1("$2")');

        return processed;
    }

    /**
     * 提取类代码块的范围。
     * 返回类块在文本中的起始和结束索引。
     */
    private extractClassBlock(content: string, startIndex: number): { startIndex: number; endIndex: number } | null {
        // 向前查找，包含类定义前的所有注解
        let actualStartIndex = startIndex;

        // 从 class/interface 位置向前查找注解（逐行查找）
        let i = startIndex - 1;
        while (i >= 0) {
            // 查找当前行的开始位置
            let lineEnd = i;
            while (lineEnd >= 0 && content[lineEnd] !== '\n') {
                lineEnd--;
            }

            if (lineEnd < 0) {
                // 到达文件开头
                actualStartIndex = 0;
                break;
            }

            // lineEnd 指向换行符，lineEnd+1 是下一行的开始
            // 查找前一行（lineEnd前面的换行符）
            let prevLineEnd = lineEnd - 1;
            while (prevLineEnd >= 0 && content[prevLineEnd] !== '\n') {
                prevLineEnd--;
            }

            // prevLineEnd+1 到 lineEnd 是当前行
            const currentLine = content.substring(prevLineEnd + 1, lineEnd).trim();

            // 如果当前行是注解、注释或空行，继续向前
            if (currentLine === '' ||
                currentLine.startsWith('@') ||
                currentLine.startsWith('//') ||
                currentLine.startsWith('/*') ||
                currentLine.startsWith('*') ||  // 多行注释中间行
                currentLine.endsWith('*/')) {
                actualStartIndex = prevLineEnd + 1;
                i = prevLineEnd;
                continue;
            } else {
                // 非注解行（如 import、package 等），停止
                break;
            }
        }

        // 从 class 关键字位置开始查找第一个 {，确保跳过注释中的括号
        let firstBraceIndex = startIndex;
        while (firstBraceIndex < content.length) {
            if (content[firstBraceIndex] === '{') {
                break;
            }
            firstBraceIndex++;
        }

        if (firstBraceIndex >= content.length) {
            return null; // 没有找到类块的开始括号
        }

        // 从第一个 { 开始计算括号深度（在净化文本上执行，字符串/注释中的括号已被清除）
        let braceDepth = 0;
        let endIndex = actualStartIndex;
        let foundOpenBrace = false;

        for (let j = firstBraceIndex; j < content.length; j++) {
            const char = content[j];

            if (char === '{') {
                braceDepth++;
                foundOpenBrace = true;
            } else if (char === '}') {
                braceDepth--;
                if (foundOpenBrace && braceDepth === 0) {
                    endIndex = j + 1;
                    break;
                }
            }
        }

        if (!foundOpenBrace || braceDepth !== 0) {
            return null;
        }

        return { startIndex: actualStartIndex, endIndex };
    }
}
