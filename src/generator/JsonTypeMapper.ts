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
        // 空数组与异构数组退化为平台通配类型；非空数组按首个元素推断
        const itemType = value.length > 0
            ? inferTypeFromValue(value[0], language)
            : (language === 'java' ? 'Object' : 'Any?');
        return `List<${itemType}>`;
    }
    if (typeof value === 'object') {
        return language === 'java' ? 'Object' : 'Any';
    }
    return language === 'java' ? 'Object' : 'Any?';
}

export function getImportStatements(language: TargetLanguage, useLombok = false): string {
    if (language === 'java') {
        const lines = [
            'import com.fasterxml.jackson.annotation.JsonProperty;',
            'import java.util.List;'
        ];
        if (useLombok) {
            lines.push('import lombok.Data;');
        }
        return lines.join('\n');
    }
    return 'import com.fasterxml.jackson.annotation.JsonProperty';
}
