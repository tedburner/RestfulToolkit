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

export class JsonClassGenerator {
    private nestedClasses: ClassDef[] = [];
    private nameCounter: Map<string, number> = new Map();

    generate(json: string, className: string, packageName: string, language: TargetLanguage, useLombok = false): string {
        const parsed = JSON.parse(json);
        this.nestedClasses = [];
        this.nameCounter = new Map();

        const rootDef = this.analyzeObject(parsed, className, 0);

        if (language === 'java') {
            return this.renderJava(rootDef, packageName, useLombok);
        }
        return this.renderKotlin(rootDef, packageName);
    }

    private analyzeObject(value: unknown, name: string, depth: number): ClassDef {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
            return this.analyzeObject(value[0], name, depth);
        }

        if (typeof value !== 'object' || value === null) {
            return { name, fields: [] };
        }

        const entries = Object.entries(value as Record<string, unknown>);
        const fields: FieldDef[] = [];

        for (const [key, val] of entries) {
            fields.push(this.analyzeField(key, val, depth));
        }

        return { name, fields };
    }

    private analyzeField(jsonKey: string, value: unknown, depth: number): FieldDef {
        const fieldName = toCamelCase(this.sanitizeIdentifier(jsonKey));

        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && depth < MAX_DEPTH) {
            const nestedName = this.getNestedClassName(jsonKey);
            const nestedClass = this.analyzeObject(value, nestedName, depth + 1);
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
            const nestedClass = this.analyzeObject(value, nestedName, depth + 1);
            return {
                name: fieldName,
                jsonKey,
                type: nestedClass.name,
                isNested: true,
                nestedClass
            };
        }

        const type = inferTypeFromValue(value, 'java');

        if (Array.isArray(value) && value.length === 0) {
            return {
                name: fieldName,
                jsonKey,
                type: 'List<Object>',
                isNested: false
            };
        }

        return {
            name: fieldName,
            jsonKey,
            type,
            isNested: false
        };
    }

    private getNestedClassName(jsonKey: string): string {
        const baseName = toPascalCase(this.sanitizeIdentifier(jsonKey));
        const count = (this.nameCounter.get(baseName) || 0) + 1;
        this.nameCounter.set(baseName, count);
        return count > 1 ? `${baseName}${count}` : baseName;
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
            lines.push(`${indent}@JsonProperty("${field.jsonKey}")`);
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
            const annotation = `    @JsonProperty("${f.jsonKey}")\n`;
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
            const annotation = `    @JsonProperty("${f.jsonKey}")\n`;
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
}
