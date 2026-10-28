import { toPascalCase, toCamelCase } from '../extractor/NameTransformer';
import { TargetLanguage, inferTypeFromValue, getImportStatements } from './JsonTypeMapper';

export interface FieldDef {
    name: string;
    jsonKey: string;
    type: string;
    isNested: boolean;
    nestedClass?: ClassDef;
}

export interface ClassDef {
    name: string;
    fields: FieldDef[];
}

const MAX_DEPTH = 3;

/** Java 硬关键字与字面量（含 Java 9+ 非法的单下划线）。 */
const RESERVED_JAVA = new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
    'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
    'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native',
    'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
    'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void',
    'volatile', 'while', 'true', 'false', 'null', '_'
]);

/** Kotlin 硬关键字；软关键字（data/get/set 等）作为标识符合法，不规避。Kotlin 同时规避 Java 集合。 */
const RESERVED_KOTLIN = new Set([
    'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in',
    'interface', 'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true',
    'try', 'typealias', 'typeof', 'val', 'var', 'when', 'while'
]);

export class JsonClassGenerator {
    private nestedClasses: ClassDef[] = [];
    private nameCounter: Map<string, number> = new Map();
    private usedClassNames: Set<string> = new Set();
    private language: TargetLanguage = 'java';

    generate(json: string, className: string, packageName: string, language: TargetLanguage, useLombok = false): string {
        const parsed = JSON.parse(json);
        this.nestedClasses = [];
        this.nameCounter = new Map();
        this.usedClassNames = new Set([this.baseClassName(className)]);
        this.language = language;
        // 嵌套类名不得与根类同名
        this.nameCounter.set(this.baseClassName(className), 1);

        const rootDef = this.analyzeObject(parsed, className, 0, new Set());

        if (language === 'java') {
            return this.renderJava(rootDef, packageName, useLombok);
        }
        return this.renderKotlin(rootDef, packageName);
    }

    private baseClassName(className: string): string {
        return className.split('.').pop() ?? className;
    }

    private analyzeObject(value: unknown, name: string, depth: number, usedNames: Set<string>): ClassDef {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
            return this.analyzeObject(value[0], name, depth, usedNames);
        }

        if (typeof value !== 'object' || value === null) {
            return { name, fields: [] };
        }

        const entries = Object.entries(value as Record<string, unknown>);
        const fields: FieldDef[] = [];

        for (const [key, val] of entries) {
            fields.push(this.analyzeField(key, val, depth, usedNames));
        }

        return { name, fields };
    }

    private analyzeField(jsonKey: string, value: unknown, depth: number, usedNames: Set<string>): FieldDef {
        const fieldName = this.allocateFieldName(toCamelCase(this.sanitizeIdentifier(jsonKey)), usedNames);

        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && depth < MAX_DEPTH) {
            const nestedName = this.getNestedClassName(jsonKey);
            const nestedClass = this.analyzeObject(value, nestedName, depth + 1, new Set());
            return {
                name: fieldName,
                jsonKey,
                type: `List<${nestedClass.name}>`,
                isNested: true,
                nestedClass
            };
        }

        if (typeof value === 'object' && value !== null && !Array.isArray(value) && depth < MAX_DEPTH) {
            const nestedName = this.getNestedClassName(jsonKey);
            const nestedClass = this.analyzeObject(value, nestedName, depth + 1, new Set());
            return {
                name: fieldName,
                jsonKey,
                type: nestedClass.name,
                isNested: true,
                nestedClass
            };
        }

        // 类型推断遵循目标语言（Kotlin 使用可空类型分支）
        const type = inferTypeFromValue(value, this.language);

        return {
            name: fieldName,
            jsonKey,
            type,
            isNested: false
        };
    }

    /**
     * 在同一作用域内分配合法且唯一的字段名：按目标语言规避硬关键字与既有名称，
     * 冲突时追加计数后缀。
     */
    private allocateFieldName(base: string, usedNames: Set<string>): string {
        const reserved = this.language === 'kotlin' ? RESERVED_KOTLIN : RESERVED_JAVA;
        let candidate = base;
        let counter = 1;
        while (reserved.has(candidate) || usedNames.has(candidate)) {
            counter++;
            candidate = `${base}${counter}`;
        }
        usedNames.add(candidate);
        return candidate;
    }

    private getNestedClassName(jsonKey: string): string {
        const baseName = toPascalCase(this.sanitizeIdentifier(jsonKey));
        let count = (this.nameCounter.get(baseName) || 0) + 1;
        let candidate = count > 1 ? `${baseName}${count}` : baseName;
        while (this.usedClassNames.has(candidate)) {
            count++;
            candidate = `${baseName}${count}`;
        }
        this.nameCounter.set(baseName, count);
        this.usedClassNames.add(candidate);
        return candidate;
    }

    private sanitizeIdentifier(key: string): string {
        let result = key.replace(/[^a-zA-Z0-9_]/g, '_');
        if (/^[0-9]/.test(result)) {
            result = '_' + result;
        }
        return result || 'field';
    }

    private renderJava(root: ClassDef, packageName: string, useLombok: boolean): string {
        const lines: string[] = [];
        lines.push(`package ${packageName};`);
        lines.push('');
        lines.push(getImportStatements('java', useLombok));
        lines.push('');
        if (useLombok) {
            lines.push('@Data');
        }
        lines.push(`public class ${root.name} {`);
        lines.push('');

        this.renderJavaFields(lines, root.fields);
        if (!useLombok) {
            this.renderJavaGettersSetters(lines, root.fields);
        }

        const nested = root.fields.filter(f => f.isNested && f.nestedClass).map(f => f.nestedClass!);
        this.renderJavaNestedClasses(lines, nested, '    ', useLombok);

        lines.push('}');
        return lines.join('\n');
    }

    private renderJavaNestedClasses(lines: string[], classes: ClassDef[], indent: string, useLombok: boolean) {
        for (const nc of classes) {
            if (useLombok) {
                lines.push(`${indent}@Data`);
            }
            lines.push(`${indent}public static class ${nc.name} {`);
            lines.push('');
            this.renderJavaFields(lines, nc.fields, `${indent}    `);
            if (!useLombok) {
                this.renderJavaGettersSetters(lines, nc.fields, `${indent}    `);
            }
            const deeperNested = nc.fields.filter(f => f.isNested && f.nestedClass).map(f => f.nestedClass!);
            if (deeperNested.length > 0) {
                this.renderJavaNestedClasses(lines, deeperNested, `${indent}    `, useLombok);
            }
            lines.push(`${indent}}`);
            lines.push('');
        }
    }

    private renderJavaFields(lines: string[], fields: FieldDef[], indent = '    ') {
        for (const field of fields) {
            lines.push(`${indent}@JsonProperty(${this.toStringLiteral(field.jsonKey)})`);
            lines.push(`${indent}private ${field.type} ${field.name};`);
            lines.push('');
        }
    }

    private renderJavaGettersSetters(lines: string[], fields: FieldDef[], indent = '    ') {
        for (const field of fields) {
            const capName = field.name.charAt(0).toUpperCase() + field.name.slice(1);
            lines.push(`${indent}public ${field.type} get${capName}() {`);
            lines.push(`${indent}    return ${field.name};`);
            lines.push(`${indent}}`);
            lines.push('');
            lines.push(`${indent}public void set${capName}(${field.type} ${field.name}) {`);
            lines.push(`${indent}    this.${field.name} = ${field.name};`);
            lines.push(`${indent}}`);
            lines.push('');
        }
    }

    private renderKotlin(root: ClassDef, packageName: string): string {
        const lines: string[] = [];
        lines.push(`package ${packageName}`);
        lines.push('');
        lines.push(getImportStatements('kotlin'));
        lines.push('');
        lines.push(`data class ${root.name}(`);

        const constructorFields = root.fields.map(f => {
            const annotation = `    @JsonProperty(${this.toStringLiteral(f.jsonKey)})\n`;
            return `${annotation}    val ${f.name}: ${f.type}`;
        });

        lines.push(constructorFields.join(',\n'));
        lines.push(')');

        const nested = root.fields.filter(f => f.isNested && f.nestedClass).map(f => f.nestedClass!);
        for (const nc of nested) {
            lines.push('');
            this.renderKotlinNested(lines, nc, '');
        }

        lines.push('');
        return lines.join('\n');
    }

    private renderKotlinNested(lines: string[], classDef: ClassDef, indent: string) {
        lines.push(`${indent}data class ${classDef.name}(`);
        const constructorFields = classDef.fields.map(f => {
            const annotation = `    @JsonProperty(${this.toStringLiteral(f.jsonKey)})\n`;
            return `${indent}${annotation}${indent}    val ${f.name}: ${f.type}`;
        });
        lines.push(constructorFields.join(',\n'));
        lines.push(`${indent})`);

        const nested = classDef.fields.filter(f => f.isNested && f.nestedClass).map(f => f.nestedClass!);
        for (const nc of nested) {
            lines.push('');
            this.renderKotlinNested(lines, nc, indent);
        }
    }

    private toStringLiteral(value: string): string {
        return JSON.stringify(value);
    }
}
