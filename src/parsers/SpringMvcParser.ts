import { RestEndpoint, HttpMethod } from '../models/types';
import { Logger } from '../utils/Logger';

export class SpringMvcParser {
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    parseClassLevelPath(content: string, className: string): string | null {
        const patterns = [
            /@RequestMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/,
            /@RequestMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                if (match[1].includes(',')) {
                    const paths = match[1].split(',').map(p => p.trim().replace(/"/g, '').replace(/'/g, ''));
                    this.logger.warning(`Class ${className} has multiple paths: ${paths.join(', ')}. Using first path.`);
                    return paths[0].replace(/\s+/g, '');
                }
                return match[1].replace(/\s+/g, '').replace(/"/g, '').replace(/'/g, '');
            }
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

            const methodEndpoints = this.parseAnnotationsBlock(
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

    private parseAnnotationsBlock(
        annotationBlock: string,
        classPath: string,
        className: string,
        methodName: string,
        line: number
    ): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        const mappingAnnotations = [
            { pattern: /@GetMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'GET' as HttpMethod },
            { pattern: /@PostMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'POST' as HttpMethod },
            { pattern: /@PutMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'PUT' as HttpMethod },
            { pattern: /@DeleteMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'DELETE' as HttpMethod },
            { pattern: /@PatchMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"\s*\)/, method: 'PATCH' as HttpMethod },
            { pattern: /@GetMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'GET' as HttpMethod },
            { pattern: /@PostMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'POST' as HttpMethod },
            { pattern: /@PutMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'PUT' as HttpMethod },
            { pattern: /@DeleteMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'DELETE' as HttpMethod },
            { pattern: /@PatchMapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?\{([^}]+)\}\s*\)/, method: 'PATCH' as HttpMethod }
        ];

        for (const mapping of mappingAnnotations) {
            const matches = annotationBlock.matchAll(new RegExp(mapping.pattern.source, 'g'));
            for (const match of matches) {
                const pathValue = match[1];
                if (pathValue.includes(',')) {
                    const paths = pathValue.split(',').map(p => p.trim().replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, ''));
                    for (const path of paths) {
                        endpoints.push(this.createEndpoint(
                            mapping.method,
                            this.combinePath(classPath, path),
                            className,
                            methodName,
                            line
                        ));
                    }
                } else {
                    endpoints.push(this.createEndpoint(
                        mapping.method,
                        this.combinePath(classPath, pathValue.replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, '')),
                        className,
                        methodName,
                        line
                    ));
                }
            }
        }

        const requestMappingPattern = /@RequestMapping\s*\([^)]+\)/g;
        const requestMappingMatches = annotationBlock.matchAll(requestMappingPattern);

        for (const match of requestMappingMatches) {
            const annotation = match[0];
            const endpointsFromRequestMapping = this.parseRequestMapping(annotation, classPath, className, methodName, line);
            endpoints.push(...endpointsFromRequestMapping);
        }

        return endpoints;
    }

    private parseRequestMapping(
        annotation: string,
        classPath: string,
        className: string,
        methodName: string,
        line: number
    ): RestEndpoint[] {
        const endpoints: RestEndpoint[] = [];

        const pathMatch = annotation.match(/(?:path\s*=\s*|value\s*=\s*)"([^"]+)"/);
        const methodMatch = annotation.match(/method\s*=\s*RequestMethod\.(\w+)/);

        if (!pathMatch) {
            this.logger.warning(`Could not extract path from @RequestMapping: ${annotation}`);
            return endpoints;
        }

        const path = pathMatch[1].replace(/"/g, '').replace(/\s+/g, '');
        let method: HttpMethod = 'GET';

        if (methodMatch) {
            const methodName = methodMatch[1].toUpperCase();
            if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(methodName)) {
                method = methodName as HttpMethod;
            } else {
                this.logger.warning(`Unknown RequestMethod: ${methodName}`);
            }
        }

        if (annotation.includes(',')) {
            const pathsPart = annotation.match(/(?:path\s*=\s*|value\s*=\s*)\{([^}]+)\}/);
            if (pathsPart) {
                const paths = pathsPart[1].split(',').map(p => p.trim().replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, ''));
                for (const p of paths) {
                    endpoints.push(this.createEndpoint(method, this.combinePath(classPath, p), className, methodName, line));
                }
                return endpoints;
            }
        }

        endpoints.push(this.createEndpoint(method, this.combinePath(classPath, path), className, methodName, line));
        return endpoints;
    }

    private combinePath(classPath: string, methodPath: string): string {
        if (!classPath || classPath === '') {
            return methodPath.startsWith('/') ? methodPath : '/' + methodPath;
        }

        const base = classPath.startsWith('/') ? classPath : '/' + classPath;
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
            framework: 'Spring'
        };
    }

    private getLineNumber(content: string, index: number): number {
        const lines = content.substring(0, index).split('\n');
        return lines.length;
    }
}