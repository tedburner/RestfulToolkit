import * as vscode from 'vscode';
import * as fs from 'fs';
import { DtoField } from '../models/types';

export class DtoFieldExtractor {
    private readonly maxDepth = 3;

    async findDtoFields(dtoTypeName: string, visited: Set<string> = new Set(), depth: number = 0): Promise<DtoField[]> {
        if (depth >= this.maxDepth || visited.has(dtoTypeName)) { return []; }

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return [];
        }

        const files = await vscode.workspace.findFiles(
            `**/${dtoTypeName}.{java,kt}`,
            '**/node_modules/**,**/target/**,**/build/**,**/.git/**'
        );

        if (files.length === 0) {
            return [];
        }

        visited.add(dtoTypeName);

        try {
            const content = fs.readFileSync(files[0].fsPath, 'utf-8');
            return await this.resolveNestedFields(content, visited, depth + 1);
        } catch {
            return [];
        }
    }

    parseDtoFields(content: string): DtoField[] {
        return this.parseSync(content);
    }

    private async resolveNestedFields(content: string, visited: Set<string>, depth: number): Promise<DtoField[]> {
        if (depth >= this.maxDepth) {
            return this.parseSync(content);
        }

        return await this.parseAsync(content, async (typeName: string) => {
            return await this.findDtoFields(typeName, visited, depth);
        });
    }

    /**
     * 同步解析：仅单层字段，无嵌套。
     */
    private parseSync(content: string): DtoField[] {
        const fields: DtoField[] = [];
        const lines = content.split('\n');

        let inClass = false;
        let braceDepth = 0;
        let pendingJsonName: string | null = null;
        let classNamingStrategy: ((n: string) => string) | null = null;

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                continue;
            }

            if (!inClass) {
                const jsonNamingMatch = trimmed.match(/@JsonNaming\s*\(\s*([\w.]+)\s*\)/);
                if (jsonNamingMatch) {
                    classNamingStrategy = this.resolveNamingStrategy(jsonNamingMatch[1]);
                }
            }

            if (!inClass && /\b(class|data class|object)\s+\w+/.test(trimmed)) {
                inClass = true;
                braceDepth = 0;
            }

            if (!inClass) { continue; }

            for (const char of trimmed) {
                if (char === '{') { braceDepth++; }
                else if (char === '}') { braceDepth--; }
            }
            if (braceDepth <= 0 && trimmed.includes('}')) {
                inClass = false;
                continue;
            }

            const jsonPropMatch = trimmed.match(/@JsonProperty\s*\(\s*["']([^"']+)["']\s*\)/);
            const jsonFieldMatch = trimmed.match(/@JSONField\s*\(\s*name\s*=\s*["']([^"']+)["']\s*\)/);
            if (jsonPropMatch) {
                pendingJsonName = jsonPropMatch[1];
                continue;
            }
            if (jsonFieldMatch) {
                pendingJsonName = jsonFieldMatch[1];
                continue;
            }

            const jsonAliasMatch = trimmed.match(/@JsonAlias\s*\(\s*["']([^"']+)["']\s*\)/)
                || trimmed.match(/@JsonAlias\s*\(\s*\{\s*["']([^"']+)["']/);
            if (jsonAliasMatch && !pendingJsonName) {
                pendingJsonName = jsonAliasMatch[1];
                continue;
            }

            const javaFieldMatch = trimmed.match(/(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/);
            const kotlinFieldMatch = trimmed.match(/(?:val|var)\s+(\w+)\s*:\s*(\w+(?:<[^>]+>)?)/);

            if (javaFieldMatch || kotlinFieldMatch) {
                const type = javaFieldMatch ? javaFieldMatch[1] : kotlinFieldMatch![2];
                const name = javaFieldMatch ? javaFieldMatch[2] : kotlinFieldMatch![1];
                fields.push({
                    name: pendingJsonName || (classNamingStrategy ? classNamingStrategy(name) : name),
                    type,
                    originalName: name
                });
                pendingJsonName = null;
            } else {
                if (!trimmed.startsWith('@') && !trimmed.startsWith('import ') && !trimmed.startsWith('package ')) {
                    pendingJsonName = null;
                }
            }
        }

        return fields;
    }

    private async parseAsync(
        content: string,
        resolveNested: (typeName: string) => Promise<DtoField[] | null>
    ): Promise<DtoField[]> {
        const fields: DtoField[] = [];
        const lines = content.split('\n');

        let inClass = false;
        let braceDepth = 0;
        let pendingJsonName: string | null = null;
        let classNamingStrategy: ((n: string) => string) | null = null;

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                continue;
            }

            if (!inClass) {
                const jsonNamingMatch = trimmed.match(/@JsonNaming\s*\(\s*([\w.]+)\s*\)/);
                if (jsonNamingMatch) {
                    classNamingStrategy = this.resolveNamingStrategy(jsonNamingMatch[1]);
                }
            }

            if (!inClass && /\b(class|data class|object)\s+\w+/.test(trimmed)) {
                inClass = true;
                braceDepth = 0;
            }

            if (!inClass) { continue; }

            for (const char of trimmed) {
                if (char === '{') { braceDepth++; }
                else if (char === '}') { braceDepth--; }
            }
            if (braceDepth <= 0 && trimmed.includes('}')) {
                inClass = false;
                continue;
            }

            const jsonPropMatch = trimmed.match(/@JsonProperty\s*\(\s*["']([^"']+)["']\s*\)/);
            const jsonFieldMatch = trimmed.match(/@JSONField\s*\(\s*name\s*=\s*["']([^"']+)["']\s*\)/);
            if (jsonPropMatch) {
                pendingJsonName = jsonPropMatch[1];
                continue;
            }
            if (jsonFieldMatch) {
                pendingJsonName = jsonFieldMatch[1];
                continue;
            }

            const jsonAliasMatch = trimmed.match(/@JsonAlias\s*\(\s*["']([^"']+)["']\s*\)/)
                || trimmed.match(/@JsonAlias\s*\(\s*\{\s*["']([^"']+)["']/);
            if (jsonAliasMatch && !pendingJsonName) {
                pendingJsonName = jsonAliasMatch[1];
                continue;
            }

            const javaFieldMatch = trimmed.match(/(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/);
            const kotlinFieldMatch = trimmed.match(/(?:val|var)\s+(\w+)\s*:\s*(\w+(?:<[^>]+>)?)/);

            if (javaFieldMatch || kotlinFieldMatch) {
                const type = javaFieldMatch ? javaFieldMatch[1] : kotlinFieldMatch![2];
                const name = javaFieldMatch ? javaFieldMatch[2] : kotlinFieldMatch![1];
                const field: DtoField = {
                    name: pendingJsonName || (classNamingStrategy ? classNamingStrategy(name) : name),
                    type,
                    originalName: name
                };
                if (!this.isPrimitiveType(type)) {
                    const nested = await resolveNested(type);
                    if (nested && nested.length > 0) {
                        field.nested = nested;
                    }
                }
                fields.push(field);
                pendingJsonName = null;
            } else {
                if (!trimmed.startsWith('@') && !trimmed.startsWith('import ') && !trimmed.startsWith('package ')) {
                    pendingJsonName = null;
                }
            }
        }

        return fields;
    }

    private isPrimitiveType(type: string): boolean {
        const primitives = [
            'String', 'Integer', 'Long', 'Short', 'Byte', 'Float', 'Double',
            'Boolean', 'int', 'long', 'short', 'byte', 'float', 'double',
            'boolean', 'char', 'Character', 'BigDecimal', 'BigInteger',
            'Date', 'LocalDate', 'LocalDateTime', 'ZonedDateTime',
            'MultipartFile', 'File', 'InputStream', 'byte[]',
            'List', 'Map', 'Set', 'Collection', 'Optional'
        ];
        return primitives.includes(type);
    }

    private resolveNamingStrategy(value: string): ((n: string) => string) | null {
        const snakePatterns = ['PropertyNamingStrategy.SnakeCaseStrategy', 'PropertyNamingStrategies.SnakeCaseStrategy', 'SNAKE_CASE'];
        const kebabPatterns = ['PropertyNamingStrategy.KebabCaseStrategy', 'PropertyNamingStrategies.KebabCaseStrategy', 'KEBAB_CASE'];
        if (snakePatterns.some(s => value.includes(s))) {
            return (n: string) => n.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        }
        if (kebabPatterns.some(s => value.includes(s))) {
            return (n: string) => n.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
        }
        return null;
    }
}
