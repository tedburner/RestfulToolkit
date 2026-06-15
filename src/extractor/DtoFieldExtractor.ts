import * as vscode from 'vscode';
import { DtoField } from '../models/types';
import { TextProcessor } from '../utils/TextProcessor';

/**
 * 基本类型列表，无需展开 DTO 字段。
 */
export const PRIMITIVE_TYPES = [
    'String', 'Integer', 'Long', 'Short', 'Byte', 'Float', 'Double',
    'Boolean', 'int', 'long', 'short', 'byte', 'float', 'double',
    'boolean', 'char', 'Character', 'BigDecimal', 'BigInteger',
    'Date', 'LocalDate', 'LocalDateTime', 'ZonedDateTime',
    'MultipartFile', 'File', 'InputStream', 'byte[]'
];

export class DtoFieldExtractor {
    private readonly maxDepth = 3;
    private readonly dtoFileCache = new Map<string, vscode.Uri[]>();
    private readonly sanitizedContentCache = new Map<string, string>();
    private readonly directFieldsCache = new Map<string, DtoField[]>();

    async findDtoFields(
        dtoTypeName: string,
        visited: Set<string> = new Set(),
        depth: number = 0,
        parentFQNs?: string[]
    ): Promise<DtoField[]> {
        if (depth >= this.maxDepth || visited.has(dtoTypeName)) { return []; }

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return [];
        }

        const files = await this.findDtoFiles(dtoTypeName);

        if (files.length === 0) {
            return [];
        }

        visited.add(dtoTypeName);

        try {
            let selectedFile = files[0];
            if (files.length > 1 && parentFQNs && parentFQNs.length > 0) {
                for (const fqn of parentFQNs) {
                    const pathSuffix = fqn.replace(/\./g, '/');
                    const found = files.find(file => {
                        const normalized = file.fsPath.replace(/\\/g, '/');
                        return normalized.endsWith(pathSuffix + '.java') || normalized.endsWith(pathSuffix + '.kt');
                    });
                    if (found) {
                        selectedFile = found;
                        break;
                    }
                }
            }

            const sanitized = await this.readSanitizedContent(selectedFile);
            const directFields = this.getDirectFields(selectedFile.fsPath, sanitized);
            return await this.resolveNestedFields(sanitized, visited, depth + 1, directFields);
        } catch {
            return [];
        }
    }

    parseDtoFields(content: string): DtoField[] {
        return this.parseFields(TextProcessor.sanitize(content, { preserveStrings: true }));
    }

    private async findDtoFiles(dtoTypeName: string): Promise<vscode.Uri[]> {
        const cached = this.dtoFileCache.get(dtoTypeName);
        if (cached) {
            return cached;
        }

        const files = await vscode.workspace.findFiles(
            `**/${dtoTypeName}.{java,kt}`,
            '**/node_modules/**,**/target/**,**/build/**,**/.git/**'
        );
        this.dtoFileCache.set(dtoTypeName, files);
        return files;
    }

    private async readSanitizedContent(file: vscode.Uri): Promise<string> {
        const key = this.normalizeFileKey(file.fsPath);
        const cached = this.sanitizedContentCache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const content = await TextProcessor.readFileText(file);
        const sanitized = TextProcessor.sanitize(content, { preserveStrings: true });
        this.sanitizedContentCache.set(key, sanitized);
        return sanitized;
    }

    private getDirectFields(filePath: string, content: string): DtoField[] {
        const key = this.normalizeFileKey(filePath);
        const cached = this.directFieldsCache.get(key);
        if (cached) {
            return this.cloneFields(cached);
        }

        const fields = this.parseFields(content);
        this.directFieldsCache.set(key, this.cloneFields(fields));
        return fields;
    }

    private async resolveNestedFields(
        content: string,
        visited: Set<string>,
        depth: number,
        directFields?: DtoField[]
    ): Promise<DtoField[]> {
        if (depth >= this.maxDepth) {
            return this.cloneFields(directFields ?? this.parseFields(content));
        }

        const resolveNested = async (typeName: string) => {
            const potentialFQNs = TextProcessor.buildPotentialFQNs(content, typeName);
            return await this.findDtoFields(typeName, visited, depth, potentialFQNs);
        };

        // 先同步解析字段，再异步解析嵌套 DTO
        const fields = this.cloneFields(directFields ?? this.parseFields(content));
        for (const field of fields) {
            if (!this.isPrimitiveType(field.type)) {
                const nested = await this.resolveNestedDtoFields(field.type, resolveNested);
                if (nested && nested.length > 0) {
                    field.nested = nested;
                }
            }
        }
        return fields;
    }

    private normalizeFileKey(filePath: string): string {
        return filePath.replace(/\\/g, '/');
    }

    private cloneFields(fields: DtoField[]): DtoField[] {
        return fields.map(field => ({
            ...field,
            nested: field.nested ? this.cloneFields(field.nested) : undefined
        }));
    }

    /**
     * 统一字段解析：解析 DTO 类的字段列表（同步）。
     * 嵌套 DTO 解析由调用方（resolveNestedFields）在返回后单独处理。
     */
    private parseFields(content: string): DtoField[] {
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

    private isPrimitiveType(type: string): boolean {
        if (PRIMITIVE_TYPES.includes(type)) { return true; }
        const angleIndex = type.indexOf('<');
        const genericBase = angleIndex !== -1 ? type.substring(0, angleIndex).trim() : type;
        return PRIMITIVE_TYPES.includes(genericBase);
    }

    private extractGenericTypes(typeStr: string): string[] {
        const start = typeStr.indexOf('<');
        const end = typeStr.lastIndexOf('>');
        if (start === -1 || end === -1 || end <= start) { return []; }

        const inner = typeStr.substring(start + 1, end).trim();
        const result: string[] = [];
        let current = '';
        let depth = 0;
        for (const char of inner) {
            if (char === '<') { depth++; }
            else if (char === '>') { depth--; }
            else if (char === ',' && depth === 0) {
                result.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        if (current.trim()) {
            result.push(current.trim());
        }
        return result;
    }

    private async resolveNestedDtoFields(
        type: string,
        resolveNested: (typeName: string) => Promise<DtoField[] | null>
    ): Promise<DtoField[] | null> {
        const direct = await resolveNested(type);
        if (direct && direct.length > 0) { return direct; }

        const genericTypes = this.extractGenericTypes(type);
        if (genericTypes.length === 0) { return null; }

        for (const innerType of genericTypes) {
            const inner = await resolveNested(innerType);
            if (inner && inner.length > 0) { return inner; }
        }
        return null;
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
