export function toSnakeCase(name: string): string {
    if (!name) { return name; }
    return name
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}

export function toCamelCase(name: string): string {
    if (!name) { return name; }
    return name
        .replace(/_+/g, '_')
        .replace(/^_/, '')
        .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
