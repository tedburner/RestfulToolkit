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
            const isKotlin = filePath.endsWith('.kt');
            const processedContent = isKotlin ? this.preprocessKotlin(content) : content;

            const classPattern = /(class|interface)\s+(\w+)/g;
            let classMatch;

            while ((classMatch = classPattern.exec(processedContent)) !== null) {
                const className = classMatch[2];
                const classStartIndex = classMatch.index;

                const classBlock = this.extractClassBlock(processedContent, classStartIndex);
                if (!classBlock) {
                    continue;
                }

                const springEndpoints = this.parseSpringMvc(classBlock, className, filePath);
                const jaxRsEndpoints = this.parseJaxRs(classBlock, className, filePath);

                for (const endpoint of springEndpoints) {
                    endpoint.file = filePath;
                    endpoints.push(endpoint);
                }

                for (const endpoint of jaxRsEndpoints) {
                    endpoint.file = filePath;
                    endpoints.push(endpoint);
                }
            }

            if (endpoints.length > 0) {
                this.logger.info(`Parsed ${endpoints.length} endpoints from ${filePath}`);
            }

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to parse file: ${filePath}`, err);
        }

        return endpoints;
    }

    private parseSpringMvc(content: string, className: string, filePath: string): RestEndpoint[] {
        try {
            const classPath = this.springMvcParser.parseClassLevelPath(content, className);
            return this.springMvcParser.parseMethodAnnotations(content, className, classPath);
        } catch (error) {
            const err = error as Error;
            this.logger.warning(`Spring MVC parsing failed for class ${className} in ${filePath}: ${err.message}`);
            return [];
        }
    }

    private parseJaxRs(content: string, className: string, filePath: string): RestEndpoint[] {
        try {
            const classPath = this.jaxRsParser.parseClassLevelPath(content, className);
            return this.jaxRsParser.parseMethodAnnotations(content, className, classPath);
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
        const braceDepth = { value: 0 };
        let endIndex = startIndex;
        let foundOpenBrace = false;

        for (let i = startIndex; i < content.length; i++) {
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

        return content.substring(startIndex, endIndex);
    }
}