import * as vscode from 'vscode';
import { DtoField } from '../models/types';
import { TextProcessor } from '../utils/TextProcessor';
import { SpringParameterParser } from './SpringParameterParser';
import { ConfigManager } from '../config/ConfigManager';
import { normalizePathKey, toPosixPath } from '../utils/PathUtils';

/**
 * 基本类型列表，无需展开 DTO 字段。
 */
export const PRIMITIVE_TYPES = [
    'String', 'Integer', 'Long', 'Short', 'Byte', 'Float', 'Double',
    'Boolean', 'int', 'long', 'short', 'byte', 'float', 'double',
    'boolean', 'char', 'Character', 'BigDecimal', 'BigInteger',
    'Date', 'LocalDate', 'LocalDateTime', 'ZonedDateTime', 'Instant', 'OffsetDateTime',
    'MultipartFile', 'File', 'InputStream', 'byte[]', 'Object', 'Any', 'Void', 'Unit'
];

const CONTAINER_TYPE_NAMES = new Set([
    'List', 'ArrayList', 'LinkedList', 'Set', 'HashSet', 'Collection', 'Iterable',
    'Map', 'HashMap', 'LinkedHashMap', 'Optional'
]);

const DEFAULT_DTO_EXCLUDES = [
    '**/node_modules/**',
    '**/target/**',
    '**/build/**',
    '**/.git/**',
    '**/src/test/**'
];

export class DtoFieldExtractor {
    private readonly maxDepth = 3;
    private readonly dtoFileCache = new Map<string, Promise<vscode.Uri[]>>();
    private readonly sanitizedContentCache = new Map<string, Promise<string>>();
    private readonly directFieldsCache = new Map<string, DtoField[]>();

    async findDtoFields(
        dtoTypeName: string,
        visited: Set<string> = new Set(),
        depth: number = 0,
        parentFQNs?: string[]
    ): Promise<DtoField[]> {
        const cleanType = dtoTypeName.replace(/(?:\[\]|\?)+$/, '').trim();
        if (!cleanType || depth >= this.maxDepth || visited.has(cleanType)) { return []; }

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return [];
        }

        // 若顶层类型自身为泛型容器（如 List<UserDto>），解包内部 DTO 类型
        if (cleanType.includes('<')) {
            const innerTypes = this.extractGenericTypes(cleanType);
            for (const inner of innerTypes) {
                const innerClean = inner.replace(/(?:\[\]|\?)+$/, '').trim();
                if (!this.isPrimitiveType(innerClean)) {
                    const resolved = await this.findDtoFields(innerClean, visited, depth, parentFQNs);
                    if (resolved.length > 0) {
                        return resolved;
                    }
                }
            }
            return [];
        }

        const files = await this.findDtoFiles(cleanType);
        if (files.length === 0) {
            return [];
        }

        const branchVisited = new Set(visited);
        branchVisited.add(cleanType);

        try {
            let selectedFile = files[0];
            if (files.length > 1 && parentFQNs && parentFQNs.length > 0) {
                for (const fqn of parentFQNs) {
                    const pathSuffix = fqn.replace(/\./g, '/');
                    const found = files.find(file => {
                        const normalized = toPosixPath(file.fsPath);
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
            return await this.resolveNestedFields(sanitized, branchVisited, depth + 1, directFields);
        } catch {
            return [];
        }
    }

    parseDtoFields(content: string): DtoField[] {
        return this.parseFields(TextProcessor.sanitize(content, { preserveStrings: true }));
    }

    private findDtoFiles(dtoTypeName: string): Promise<vscode.Uri[]> {
        if (!/^[A-Za-z_$][\w$]*$/.test(dtoTypeName) || CONTAINER_TYPE_NAMES.has(dtoTypeName) || PRIMITIVE_TYPES.includes(dtoTypeName)) {
            return Promise.resolve([]);
        }

        const cached = this.dtoFileCache.get(dtoTypeName);
        if (cached) {
            return cached;
        }

        const excludeSet = new Set<string>(DEFAULT_DTO_EXCLUDES);
        try {
            for (const pattern of ConfigManager.getInstance().getScanConfig().excludePaths) {
                if (pattern) {
                    excludeSet.add(pattern);
                }
            }
        } catch {
            // Ignore config lookup errors in isolated unit tests
        }
        const excludeList = Array.from(excludeSet);
        const excludeGlob = excludeList.length === 1 ? excludeList[0] : `{${excludeList.join(',')}}`;

        const lookup = Promise.resolve(
            vscode.workspace.findFiles(`**/${dtoTypeName}.{java,kt}`, excludeGlob)
        );
        this.dtoFileCache.set(dtoTypeName, lookup);
        return lookup;
    }

    private readSanitizedContent(file: vscode.Uri): Promise<string> {
        const key = normalizePathKey(file.fsPath);
        const cached = this.sanitizedContentCache.get(key);
        if (cached) {
            return cached;
        }

        const isKotlin = file.fsPath.endsWith('.kt');
        const readPromise = TextProcessor.readFileText(file).then(content =>
            TextProcessor.sanitize(content, { preserveStrings: true, rawTripleQuotes: isKotlin })
        );
        this.sanitizedContentCache.set(key, readPromise);
        return readPromise;
    }

    private getDirectFields(filePath: string, content: string): DtoField[] {
        const key = normalizePathKey(filePath);
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
        const fields = this.cloneFields(directFields ?? this.parseFields(content));
        if (depth >= this.maxDepth) {
            return fields;
        }

        await Promise.all(fields.map(async (field) => {
            if (!this.isPrimitiveType(field.type)) {
                const fieldVisited = new Set(visited);
                const resolveNested = async (typeName: string) => {
                    const cleanInner = typeName.replace(/(?:\[\]|\?)+$/, '').trim();
                    const potentialFQNs = TextProcessor.buildPotentialFQNs(content, cleanInner);
                    return await this.findDtoFields(cleanInner, fieldVisited, depth, potentialFQNs);
                };
                const nested = await this.resolveNestedDtoFields(field.type, resolveNested);
                if (nested && nested.length > 0) {
                    field.nested = nested;
                }
            }
        }));

        return fields;
    }

    private cloneFields(fields: DtoField[]): DtoField[] {
        return fields.map(field => ({
            ...field,
            nested: field.nested ? this.cloneFields(field.nested) : undefined
        }));
    }

    /**
     * 统一字段解析：解析 Java class、Java record 或 Kotlin data class 的可序列化实例字段列表。
     * 排除 static、transient 与 @JsonIgnore 字段。
     */
    private parseFields(content: string): DtoField[] {
        const namingMatch = content.match(/@(?:[\w.]+\.)?JsonNaming\s*\(\s*([\w.]+)\s*\)/);
        const classNamingStrategy = namingMatch ? this.resolveNamingStrategy(namingMatch[1]) : null;

        const recordFields = this.tryParseJavaRecord(content, classNamingStrategy);
        if (recordFields !== null) {
            return recordFields;
        }

        const fields: DtoField[] = [];
        const lines = content.split('\n');

        let inClass = false;
        let braceDepth = 0;
        let pendingJsonName: string | null = null;
        let pendingJsonIgnore = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                continue;
            }

            if (!inClass && /\b(class|data\s+class|object)\s+\w+/.test(trimmed)) {
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

            if (this.hasJsonIgnoreAnnotation(trimmed)) {
                pendingJsonIgnore = true;
            }

            const extractedJsonName = this.extractExplicitJsonName(trimmed, pendingJsonName);
            if (extractedJsonName !== null) {
                pendingJsonName = extractedJsonName;
            }

            // 仅处理顶层字段声明（方法体 braceDepth > 1 内的局部变量忽略）
            if (braceDepth > 1) {
                continue;
            }

            // 显式排除 Java static / transient 字段（如 serialVersionUID、Logger）
            if (/^(?:@\S+\s+)*(?:private|protected|public)?\s*(?:(?:static|transient|final|volatile)\s+)*(?:static|transient)\b/.test(trimmed)) {
                pendingJsonName = null;
                pendingJsonIgnore = false;
                continue;
            }

            const strippedFieldLine = SpringParameterParser.extractLeadingAnnotations(trimmed).remainder;
            const javaFieldMatch = strippedFieldLine.match(
                /^(?:(?:private|protected|public)\s+)?(?:final\s+)?([A-Za-z_$][\w$.]*(?:<[^;=]+>)?(?:\s*\[\s*\])*)\s+([A-Za-z_$][\w$]*)\s*[;=]/
            );
            const kotlinFieldMatch = strippedFieldLine.match(
                /^(?:(?:private|protected|public|internal|override)\s+)*(?:val|var)\s+([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$.]*(?:<[^?=,)]+>)?(?:\s*\[\s*\])*)/
            );

            // Java 字段在类体内要求带可见性修饰符（或前置字段注解），避免把无参方法等误判为字段
            const hasVisibilityOrAnnotation = /^(?:@|(?:private|protected|public)\b)/.test(trimmed);
            if ((javaFieldMatch && hasVisibilityOrAnnotation) || kotlinFieldMatch) {
                if (!pendingJsonIgnore) {
                    const rawType = javaFieldMatch ? javaFieldMatch[1] : kotlinFieldMatch![2];
                    const type = rawType.replace(/\s*\[\s*\]/g, '[]').trim();
                    const name = javaFieldMatch ? javaFieldMatch[2] : kotlinFieldMatch![1];
                    fields.push({
                        name: pendingJsonName || (classNamingStrategy ? classNamingStrategy(name) : name),
                        type,
                        originalName: name
                    });
                }
                pendingJsonName = null;
                pendingJsonIgnore = false;
            } else if (!trimmed.startsWith('@') && !trimmed.startsWith('import ') && !trimmed.startsWith('package ')) {
                pendingJsonName = null;
                pendingJsonIgnore = false;
            }
        }

        return fields;
    }

    private tryParseJavaRecord(
        content: string,
        classNamingStrategy: ((n: string) => string) | null
    ): DtoField[] | null {
        const recordMatch = content.match(/\brecord\s+[A-Za-z_$][\w$]*(?:\s*<[^>]*>)?\s*\(/);
        if (!recordMatch || recordMatch.index === undefined) {
            return null;
        }

        const openParen = recordMatch.index + recordMatch[0].length - 1;
        let depth = 1;
        let i = openParen + 1;
        let inQuote: string | null = null;
        while (i < content.length && depth > 0) {
            const ch = content[i];
            if (inQuote) {
                if (ch === '\\') {
                    i += 2;
                    continue;
                }
                if (ch === inQuote) {
                    inQuote = null;
                }
                i++;
                continue;
            }
            if (ch === '"' || ch === "'") {
                inQuote = ch;
                i++;
                continue;
            }
            if (ch === '(') { depth++; }
            else if (ch === ')') { depth--; }
            i++;
        }
        if (depth !== 0) {
            return null;
        }

        const header = content.slice(openParen + 1, i - 1).trim();
        if (!header) {
            return [];
        }

        const fields: DtoField[] = [];
        for (const component of SpringParameterParser.splitParameters(header)) {
            if (this.hasJsonIgnoreAnnotation(component)) {
                continue;
            }
            const explicitJsonName = this.extractExplicitJsonName(component, null);
            const { remainder } = SpringParameterParser.extractLeadingAnnotations(component);
            const typeAndName = SpringParameterParser.extractTypeAndName(remainder);
            if (!typeAndName) {
                continue;
            }
            const originalName = typeAndName.varName;
            fields.push({
                name: explicitJsonName || (classNamingStrategy ? classNamingStrategy(originalName) : originalName),
                type: typeAndName.type,
                originalName
            });
        }
        return fields;
    }

    private hasJsonIgnoreAnnotation(text: string): boolean {
        const match = text.match(/@(?:[\w.]+\.)?JsonIgnore\b(?:\s*\(\s*(false)\s*\))?/);
        return Boolean(match && match[1] !== 'false');
    }

    private extractExplicitJsonName(text: string, currentPending: string | null): string | null {
        const jsonPropMatch = text.match(/@(?:[\w.]+\.)?JsonProperty\s*\((?:[^)"']*?\bvalue\s*=\s*|\s*)["']([^"']+)["']/);
        if (jsonPropMatch) {
            return jsonPropMatch[1];
        }
        const jsonFieldMatch = text.match(/@(?:[\w.]+\.)?JSONField\s*\([^)]*?\bname\s*=\s*["']([^"']+)["']/);
        if (jsonFieldMatch) {
            return jsonFieldMatch[1];
        }
        if (!currentPending) {
            const jsonAliasMatch = text.match(/@(?:[\w.]+\.)?JsonAlias\s*\(\s*(?:\{\s*)?["']([^"']+)["']/);
            if (jsonAliasMatch) {
                return jsonAliasMatch[1];
            }
        }
        return null;
    }

    private isPrimitiveType(type: string): boolean {
        const clean = type.replace(/(?:\[\]|\?)+$/, '').trim();
        if (PRIMITIVE_TYPES.includes(type) || PRIMITIVE_TYPES.includes(clean)) { return true; }
        const angleIndex = clean.indexOf('<');
        const genericBase = angleIndex !== -1 ? clean.substring(0, angleIndex).trim() : clean;
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
        const clean = type.replace(/(?:\[\]|\?)+$/, '').trim();
        if (!clean.includes('<')) {
            const direct = await resolveNested(clean);
            if (direct && direct.length > 0) { return direct; }
            return null;
        }

        const genericTypes = this.extractGenericTypes(clean);
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
