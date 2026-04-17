import { RestEndpoint, HttpMethod } from '../models/types';
import { Logger } from '../utils/Logger';

export class JaxRsParser {
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    parseClassLevelPath(content: string, className: string): string | null {
        const pattern = /@Path\s*\(\s*"([^"]+)"\s*\)/;
        const match = content.match(pattern);

        if (match) {
            this.logger.info(`Found class-level path for ${className}: ${match[1]}`);
            return match[1].replace(/\s+/g, '');
        }

        return null;
    }

    parseMethodAnnotations(content: string, className: string, classPath: string | null): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        const methodPattern = /(?:public|private|protected)?\s+\w+\s+(\w+)\s*\([^)]*\)\s*\{[^}]*\}/g;
        let methodMatch;

        while ((methodMatch = methodPattern.exec(content)) !== null) {
            const methodName = methodMatch[1];
            const methodStartIndex = methodMatch.index;

            const annotationBlock = this.getAnnotationBlock(content, methodStartIndex);
            if (!annotationBlock) {
                continue;
            }

            const methodEndpoints = this.parseJaxRsAnnotations(
                annotationBlock,
                classPath || '',
                className,
                methodName,
                this.getLineNumber(content, methodStartIndex)
            );

            endpoints.push(...methodEndpoints);
        }

        return endpoints;
    }

    private parseJaxRsAnnotations(
        annotationBlock: string,
        classPath: string,
        className: string,
        methodName: string,
        line: number
    ): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        const httpMethods: { pattern: RegExp; method: HttpMethod }[] = [
            { pattern: /@GET/, method: 'GET' },
            { pattern: /@POST/, method: 'POST' },
            { pattern: /@PUT/, method: 'PUT' },
            { pattern: /@DELETE/, method: 'DELETE' },
            { pattern: /@PATCH/, method: 'PATCH' }
        ];

        for (const httpMethod of httpMethods) {
            if (annotationBlock.match(httpMethod.pattern)) {
                const pathMatch = annotationBlock.match(/@Path\s*\(\s*"([^"]+)"\s*\)/);
                const methodPath = pathMatch ? pathMatch[1].replace(/\s+/g, '') : '';

                endpoints.push(this.createEndpoint(
                    httpMethod.method,
                    this.combinePath(classPath, methodPath),
                    className,
                    methodName,
                    line
                ));
            }
        }

        return endpoints;
    }

    private getAnnotationBlock(content: string, methodIndex: number): string | null {
        let endIndex = methodIndex;
        while (endIndex > 0 && content[endIndex - 1] !== '\n') {
            endIndex--;
        }

        let startIndex = endIndex;
        let annotationDepth = 0;

        while (startIndex > 0) {
            const char = content[startIndex - 1];
            if (char === '@') {
                annotationDepth++;
            }
            if (annotationDepth === 0 && (char === '\n' || char === '{')) {
                break;
            }
            startIndex--;
        }

        if (annotationDepth === 0) {
            return null;
        }

        return content.substring(startIndex, endIndex);
    }

    private combinePath(classPath: string, methodPath: string): string {
        if (!classPath || classPath === '') {
            if (!methodPath || methodPath === '') {
                return '/';
            }
            return methodPath.startsWith('/') ? methodPath : '/' + methodPath;
        }

        const base = classPath.startsWith('/') ? classPath : '/' + classPath;

        if (!methodPath || methodPath === '') {
            return base;
        }

        const method = methodPath.startsWith('/') ? methodPath : '/' + methodPath;
        return base + method;
    }

    private createEndpoint(
        method: HttpMethod,
        path: string,
        className: string,
        methodName: string,
        line: number
    ): RestEndpoint {
        return {
            method,
            path,
            className,
            methodName,
            file: '',
            line,
            framework: 'JAX-RS'
        };
    }

    private getLineNumber(content: string, index: number): number {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }
}