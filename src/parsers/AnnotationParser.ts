import { RestEndpoint } from '../models/types';
import { SpringMvcParser } from './SpringMvcParser';
import { JaxRsParser } from './JaxRsParser';
import { Logger } from '../utils/Logger';

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

            const classPattern = /(class|interface)\s+(\w+)/g;
            let classMatch;

            while ((classMatch = classPattern.exec(content)) !== null) {
                const className = classMatch[2];
                const classStartIndex = classMatch.index;

                const classBlock = this.extractClassBlock(content, classStartIndex);
                if (!classBlock) {
                    continue;
                }

                // 计算类块在文件中的起始位置（绝对位置）
                const classBlockStartIndex = content.indexOf(classBlock);
                // 计算类块起始行号（文件中的绝对行号）
                const classBlockStartLine = content.substring(0, classBlockStartIndex).split('\n').length;

                const springEndpoints = this.parseSpringMvc(classBlock, className, filePath, classBlockStartLine);
                const jaxRsEndpoints = this.parseJaxRs(classBlock, className, filePath, classBlockStartLine);

                endpoints.push(...springEndpoints, ...jaxRsEndpoints);
            }

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Parse failed: ${filePath}`, err);
        }

        return endpoints;
    }

    private parseSpringMvc(content: string, className: string, filePath: string, classBlockStartLine: number): RestEndpoint[] {
        try {
            const classPath = this.springMvcParser.parseClassLevelPath(content);
            const endpoints = this.springMvcParser.parseMethodAnnotations(content, className, classPath, filePath);

            // 将类块内的相对行号转换为文件绝对行号
            endpoints.forEach(ep => {
                ep.line = classBlockStartLine + ep.line - 1;
            });

            if (classPath && endpoints.length > 0) {
                this.logger.info(`Class ${className}: @RequestMapping("${classPath}") → ${endpoints.length} endpoints`);
            }

            return endpoints;
        } catch (error) {
            return [];
        }
    }

    private parseJaxRs(content: string, className: string, filePath: string, classBlockStartLine: number): RestEndpoint[] {
        try {
            const classPath = this.jaxRsParser.parseClassLevelPath(content);
            const endpoints = this.jaxRsParser.parseMethodAnnotations(content, className, classPath, filePath);

            // 将类块内的相对行号转换为文件绝对行号
            endpoints.forEach(ep => {
                ep.line = classBlockStartLine + ep.line - 1;
            });

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

        processed = processed.replace(/\$\{[^}]+\}/g, '${...}');

        return processed;
    }

    private extractClassBlock(content: string, startIndex: number): string | null {
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

        // 从第一个 { 开始计算括号深度
        const braceDepth = { value: 0 };
        let endIndex = actualStartIndex;
        let foundOpenBrace = false;

        for (let i = firstBraceIndex; i < content.length; i++) {
            const char = content[i];

            if (char === '{') {
                braceDepth.value++;
                foundOpenBrace = true;
            } else if (char === '}') {
                braceDepth.value--;
                if (foundOpenBrace && braceDepth.value === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }

        if (!foundOpenBrace || braceDepth.value !== 0) {
            return null;
        }

        return content.substring(actualStartIndex, endIndex);
    }
}