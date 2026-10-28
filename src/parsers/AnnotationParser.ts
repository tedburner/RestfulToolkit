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

/** 完整注解解析状态；失败结果不可用于替换已缓存的端点快照。 */
export interface AnnotationParseResult {
    success: boolean;
    endpoints: RestEndpoint[];
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
        const result = this.parseFileResult(content, filePath);
        return result.success ? result.endpoints : [];
    }

    /**
     * 解析源码并显式区分成功空结果与解析失败，供扫描器安全维护端点快照。
     *
     * @param content 当前源码文本
     * @param filePath 源文件路径，用于 Kotlin 预处理和错误日志
     * @returns 完整解析状态及端点；任一类解析器异常时 success 为 false
     */
    parseFileResult(content: string, filePath: string): AnnotationParseResult {
        const endpoints: RestEndpoint[] = [];

        try {
            if (filePath.endsWith('.kt')) {
                content = this.preprocessKotlin(content);
            }

            const sanitized = TextProcessor.sanitize(content);
            const lineIndex = TextProcessor.buildLineIndex(content);

            const classBlocks = this.collectClassBlocks(sanitized);
            const directChildren = this.collectDirectChildren(classBlocks);
            for (const blockRange of classBlocks) {
                const children = directChildren.get(blockRange) ?? [];
                // 一次性遮罩直接子类型区间；孙辈已包含在子类型范围内，无需重复处理
                const classBlock = this.extractMaskedBlock(content, blockRange, children);
                const classBlockSanitized = this.extractMaskedBlock(sanitized, blockRange, children);

                const springEndpoints = this.parseSpringMvc(classBlock, classBlockSanitized, blockRange.className, filePath, lineIndex, blockRange.startIndex);
                const jaxRsEndpoints = this.parseJaxRs(classBlock, classBlockSanitized, blockRange.className, filePath, lineIndex, blockRange.startIndex);

                endpoints.push(...springEndpoints, ...jaxRsEndpoints);
            }

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Parse failed: ${filePath}`, err);
            return { success: false, endpoints: [] };
        }

        return { success: true, endpoints };
    }

    /**
     * 提取类块并用一次字符遍历遮罩全部直接子类型区间（保留换行符）。
     */
    private extractMaskedBlock(content: string, blockRange: ClassBlockRange, children: ClassBlockRange[]): string {
        const block = content.substring(blockRange.startIndex, blockRange.endIndex);
        if (children.length === 0) {
            return block;
        }

        const chars = block.split('');
        for (const child of children) {
            const start = Math.max(0, child.startIndex - blockRange.startIndex);
            const end = Math.min(chars.length, child.endIndex - blockRange.startIndex);
            for (let index = start; index < end; index++) {
                if (chars[index] !== '\n' && chars[index] !== '\r') {
                    chars[index] = ' ';
                }
            }
        }
        return chars.join('');
    }

    /**
     * 用栈建立类型包含关系，返回每个块的直接子类型映射。
     */
    private collectDirectChildren(classBlocks: ClassBlockRange[]): Map<ClassBlockRange, ClassBlockRange[]> {
        const sorted = [...classBlocks].sort((left, right) =>
            left.startIndex - right.startIndex || right.endIndex - left.endIndex);
        const directChildren = new Map<ClassBlockRange, ClassBlockRange[]>();
        const stack: ClassBlockRange[] = [];

        for (const block of sorted) {
            // 兄弟块的 endIndex 等于下一个块的 startIndex（共享边界字符），非包含关系
            while (stack.length > 0 && stack[stack.length - 1].endIndex <= block.startIndex) {
                stack.pop();
            }
            const parent = stack[stack.length - 1];
            if (parent) {
                const siblings = directChildren.get(parent);
                if (siblings) {
                    siblings.push(block);
                } else {
                    directChildren.set(parent, [block]);
                }
            }
            stack.push(block);
        }

        return directChildren;
    }

    private parseSpringMvc(content: string, sanitizedContent: string, className: string, filePath: string, lineIndex: number[], contentOffset: number): RestEndpoint[] {
        const classPaths = this.springMvcParser.parseClassLevelPaths(content, sanitizedContent);
        const endpoints = this.springMvcParser.parseMethodAnnotations(content, className, classPaths, filePath, lineIndex, contentOffset, sanitizedContent);

        if (classPaths.length > 0 && endpoints.length > 0) {
            this.logger.info(`Class ${className}: @RequestMapping("${classPaths.join('", "')}") → ${endpoints.length} endpoints`);
        }

        return endpoints;
    }

    private parseJaxRs(content: string, sanitizedContent: string, className: string, filePath: string, lineIndex: number[], contentOffset: number): RestEndpoint[] {
        const classPath = this.jaxRsParser.parseClassLevelPath(content, sanitizedContent);
        return this.jaxRsParser.parseMethodAnnotations(content, sanitizedContent, className, classPath, filePath, lineIndex, contentOffset);
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
}
