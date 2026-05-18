export type TargetLanguage = 'java' | 'kotlin';

export function inferTypeFromValue(value: unknown, language: TargetLanguage): string {
    if (value === null || value === undefined) {
        return language === 'java' ? 'Object' : 'Any?';
    }
    if (typeof value === 'string') {
        return 'String';
    }
    if (typeof value === 'boolean') {
        return 'Boolean';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'Long' : 'Double';
    }
    if (Array.isArray(value)) {
        const itemType = value.length > 0 ? inferTypeFromValue(value[0], language) : 'Object';
        return `List<${itemType}>`;
    }
    if (typeof value === 'object') {
        return 'Object';
    }
    return 'Object';
}

export function getImportStatements(language: TargetLanguage): string {
    if (language === 'java') {
        return 'import com.fasterxml.jackson.annotation.JsonProperty;\nimport java.util.List;';
    }
    return 'import com.fasterxml.jackson.annotation.JsonProperty';
}
