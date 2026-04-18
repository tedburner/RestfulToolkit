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
            const classPattern = /(class|interface)\s+(\w+)/g;
            let classMatch;

            while ((classMatch = classPattern.exec(content)) !== null) {
                const className = classMatch[2];
                const classStartIndex = classMatch.index;

                const classBlock = this.extractClassBlock(content, classStartIndex);
                if (!classBlock) {
                    continue;
                }

                const springEndpoints = this.parseSpringMvc(classBlock, className, filePath);
                const jaxRsEndpoints = this.parseJaxRs(classBlock, className, filePath);

                endpoints.push(...springEndpoints, ...jaxRsEndpoints);
            }

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Parse failed: ${filePath}`, err);
        }

        return endpoints;
    }

    private parseSpringMvc(content: string, className: string, filePath: string): RestEndpoint[] {
        try {
            const classPath = this.springMvcParser.parseClassLevelPath(content, className);
            const endpoints = this.springMvcParser.parseMethodAnnotations(content, className, classPath, filePath);

            if (classPath && endpoints.length > 0) {
                this.logger.info(`Class ${className}: @RequestMapping("${classPath}") → ${endpoints.length} endpoints`);
            }

            return endpoints;
        } catch (error) {
            const err = error as Error;
            return [];
        }
    }

    private parseJaxRs(content: string, className: string, filePath: string): RestEndpoint[] {
        try {
            const classPath = this.jaxRsParser.parseClassLevelPath(content, className);
            return this.jaxRsParser.parseMethodAnnotations(content, className, classPath, filePath);
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

        // 从 class/interface 位置向前查找注解
        for (let i = startIndex - 1; i >= 0; i--) {
            const char = content[i];

            // 空行或换行后的非注解内容则停止
            if (char === '\n') {
                // 检查前一行是否是注解或注释
                let lineStart = i - 1;
                while (lineStart >= 0 && content[lineStart] !== '\n') {
                    lineStart--;
                }
                const prevLine = content.substring(lineStart + 1, i).trim();

                // 如果前一行是注解或空行，继续向前查找
                if (prevLine === '' || prevLine.startsWith('@') || prevLine.startsWith('//') || prevLine.startsWith('/*')) {
                    actualStartIndex = lineStart + 1;
                    continue;
                } else {
                    // 非注解行，停止向前查找
                    break;
                }
            }

            // 非空白字符且不是换行
            if (char !== ' ' && char !== '\t' && char !== '\r') {
                // 如果是注解，继续向前
                if (char === '@') {
                    continue;
                }
                // 其他字符（如修饰符 public 等），停止
                if (i < startIndex - 50) {
                    break;
                }
            }
        }

        const braceDepth = { value: 0 };
        let endIndex = actualStartIndex;
        let foundOpenBrace = false;

        for (let i = actualStartIndex; i < content.length; i++) {
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