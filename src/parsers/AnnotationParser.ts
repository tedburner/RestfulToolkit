import { RestEndpoint } from '../models/types';
import { SpringMvcParser } from './SpringMvcParser';
import { JaxRsParser } from './JaxRsParser';
import { Logger } from '../utils/Logger';
import { TextProcessor } from '../utils/TextProcessor';

interface ClassBlockRange {
    className: string;
    declarationIndex: number;
    startIndex: number;
    endIndex: number;
}

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

            const classBlocks = this.collectClassBlocks(sanitized);
            for (const blockRange of classBlocks) {
                let classBlock = content.substring(blockRange.startIndex, blockRange.endIndex);
                let classBlockSanitized = sanitized.substring(blockRange.startIndex, blockRange.endIndex);

                for (const descendant of classBlocks) {
                    if (descendant.declarationIndex <= blockRange.declarationIndex || descendant.endIndex > blockRange.endIndex) {
                        continue;
                    }
                    const maskStart = descendant.startIndex - blockRange.startIndex;
                    const maskEnd = descendant.endIndex - blockRange.startIndex;
                    classBlock = this.maskRange(classBlock, maskStart, maskEnd);
                    classBlockSanitized = this.maskRange(classBlockSanitized, maskStart, maskEnd);
                }

                const springEndpoints = this.parseSpringMvc(classBlock, blockRange.className, filePath, lineIndex, blockRange.startIndex);
                const jaxRsEndpoints = this.parseJaxRs(classBlock, classBlockSanitized, blockRange.className, filePath, lineIndex, blockRange.startIndex);

                endpoints.push(...springEndpoints, ...jaxRsEndpoints);
            }

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Parse failed: ${filePath}`, err);
        }

        return endpoints;
    }

    private parseSpringMvc(content: string, className: string, filePath: string, lineIndex: number[], contentOffset: number): RestEndpoint[] {
        try {
            const classPath = this.springMvcParser.parseClassLevelPath(content);
            const endpoints = this.springMvcParser.parseMethodAnnotations(content, className, classPath, filePath, lineIndex, contentOffset);

            if (classPath && endpoints.length > 0) {
                this.logger.info(`Class ${className}: @RequestMapping("${classPath}") → ${endpoints.length} endpoints`);
            }

            return endpoints;
        } catch (error) {
            return [];
        }
    }

    private parseJaxRs(content: string, sanitizedContent: string, className: string, filePath: string, lineIndex: number[], contentOffset: number): RestEndpoint[] {
        try {
            const classPath = this.jaxRsParser.parseClassLevelPath(content);
            const endpoints = this.jaxRsParser.parseMethodAnnotations(content, sanitizedContent, className, classPath, filePath, lineIndex, contentOffset);

            return endpoints;
        } catch (error) {
            const err = error as Error;
            this.logger.warning(`JAX-RS parsing failed for class ${className} in ${filePath}: ${err.message}`);
            return [];
        }
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
        const actualStartIndex = this.findDeclarationStart(content, startIndex);

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

    private collectClassBlocks(content: string): ClassBlockRange[] {
        const blocks: ClassBlockRange[] = [];
        const classPattern = /\b(class|interface|object)\s+(\w+)/g;
        let classMatch: RegExpExecArray | null;

        while ((classMatch = classPattern.exec(content)) !== null) {
            const range = this.extractClassBlock(content, classMatch.index);
            if (range) {
                blocks.push({
                    className: classMatch[2],
                    declarationIndex: classMatch.index,
                    ...range
                });
            }
        }
        return blocks;
    }

    private findDeclarationStart(content: string, declarationIndex: number): number {
        let parenthesisDepth = 0;
        let bracketDepth = 0;

        for (let index = declarationIndex - 1; index >= 0; index--) {
            const char = content[index];
            if (char === ')') {
                parenthesisDepth++;
            } else if (char === '(' && parenthesisDepth > 0) {
                parenthesisDepth--;
            } else if (char === ']') {
                bracketDepth++;
            } else if (char === '[' && bracketDepth > 0) {
                bracketDepth--;
            } else if (parenthesisDepth === 0 && bracketDepth === 0 && (char === ';' || char === '{' || char === '}')) {
                return index + 1;
            }
        }
        return 0;
    }

    private maskRange(content: string, startIndex: number, endIndex: number): string {
        const chars = content.split('');
        const start = Math.max(0, startIndex);
        const end = Math.min(chars.length, endIndex);
        for (let index = start; index < end; index++) {
            if (chars[index] !== '\n' && chars[index] !== '\r') {
                chars[index] = ' ';
            }
        }
        return chars.join('');
    }
}
