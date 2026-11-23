import * as vscode from 'vscode';

export interface SanitizeOptions {
    preserveStrings?: boolean;
    /** Kotlin 原生三引号字符串（反斜杠不作转义符，尾随多余引号可闭合）。 */
    rawTripleQuotes?: boolean;
}

export class TextProcessor {
    private static textDecoder = new TextDecoder('utf-8');

    static async readFileText(uri: vscode.Uri): Promise<string> {
        const fileData = await vscode.workspace.fs.readFile(uri);
        return this.textDecoder.decode(fileData);
    }

    static sanitize(code: string, options?: SanitizeOptions): string {
        const preserveStrings = options?.preserveStrings ?? false;
        const rawTripleQuotes = options?.rawTripleQuotes ?? false;
        const chars = code.split('');
        let i = 0;

        while (i < chars.length) {
            if (chars[i] === '"' && i + 2 < chars.length && chars[i + 1] === '"' && chars[i + 2] === '"') {
                i = this.processTripleQuoted(chars, i, preserveStrings, rawTripleQuotes);
                continue;
            }
            if (chars[i] === '"') {
                i = preserveStrings ? this.skipQuoted(chars, '"', i) : this.processQuoted(chars, '"', i);
                continue;
            }
            if (chars[i] === "'") {
                i = preserveStrings ? this.skipQuoted(chars, "'", i) : this.processQuoted(chars, "'", i);
                continue;
            }
            if (chars[i] === '/' && i + 1 < chars.length && chars[i + 1] === '/') {
                while (i < chars.length && chars[i] !== '\n') {
                    chars[i] = ' ';
                    i++;
                }
                continue;
            }
            if (chars[i] === '/' && i + 1 < chars.length && chars[i + 1] === '*') {
                chars[i] = ' ';
                i++;
                chars[i] = ' ';
                i++;

                while (i < chars.length) {
                    if (chars[i] === '*' && i + 1 < chars.length && chars[i + 1] === '/') {
                        chars[i] = ' ';
                        i++;
                        chars[i] = ' ';
                        i++;
                        break;
                    }
                    if (chars[i] !== '\n') {
                        chars[i] = ' ';
                    }
                    i++;
                }
                continue;
            }
            i++;
        }

        return chars.join('');
    }

    private static processTripleQuoted(
        chars: string[],
        start: number,
        preserveStrings: boolean,
        rawTripleQuotes: boolean
    ): number {
        if (!preserveStrings) {
            chars[start] = ' ';
            chars[start + 1] = ' ';
            chars[start + 2] = ' ';
        }
        let i = start + 3;

        while (i < chars.length) {
            if (!rawTripleQuotes && chars[i] === '\\') {
                if (!preserveStrings) {
                    chars[i] = ' ';
                }
                i++;
                if (i < chars.length) {
                    if (!preserveStrings && chars[i] !== '\n') {
                        chars[i] = ' ';
                    }
                    i++;
                }
                continue;
            }

            if (
                chars[i] === '"'
                && i + 2 < chars.length
                && chars[i + 1] === '"'
                && chars[i + 2] === '"'
                && !(rawTripleQuotes && i + 3 < chars.length && chars[i + 3] === '"')
            ) {
                if (!preserveStrings) {
                    chars[i] = ' ';
                    chars[i + 1] = ' ';
                    chars[i + 2] = ' ';
                }
                return i + 3;
            }

            if (!preserveStrings && chars[i] !== '\n') {
                chars[i] = ' ';
            }
            i++;
        }

        return i;
    }

    private static skipQuoted(chars: string[], quoteChar: string, start: number): number {
        let i = start + 1;
        while (i < chars.length && chars[i] !== quoteChar) {
            if (chars[i] === '\\') {
                i += 2;
            } else {
                i++;
            }
        }
        if (i < chars.length) {
            i++;
        }
        return i;
    }

    private static processQuoted(chars: string[], quoteChar: string, start: number): number {
        chars[start] = ' ';
        let i = start + 1;

        while (i < chars.length && chars[i] !== quoteChar) {
            if (chars[i] === '\\') {
                chars[i] = ' ';
                i++;
                if (i < chars.length && chars[i] !== '\n') {
                    chars[i] = ' ';
                }
                i++;
                continue;
            }
            if (chars[i] !== '\n') {
                chars[i] = ' ';
            }
            i++;
        }

        if (i < chars.length) {
            chars[i] = ' ';
            i++;
        }

        return i;
    }

    static buildLineIndex(code: string): number[] {
        const indices: number[] = [];
        for (let i = 0; i < code.length; i++) {
            if (code[i] === '\n') {
                indices.push(i);
            }
        }
        return indices;
    }

    static getLineNumber(lineIndex: number[], charIndex: number): number {
        let lo = 0;
        let hi = lineIndex.length;

        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (lineIndex[mid] < charIndex) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }

        return lo + 1;
    }

    static getLineNumberFallback(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }

    static buildPotentialFQNs(documentText: string, typeName: string): string[] {
        const packageMatch = documentText.match(/package\s+([\w.]+)/);
        const packageName = packageMatch ? packageMatch[1] : '';
        const importMatches = Array.from(documentText.matchAll(/import\s+([\w.*]+)/g)).map(match => match[1]);

        const potentialFQNs: string[] = [];
        const explicitImport = importMatches.find(importName => importName.endsWith('.' + typeName));
        if (explicitImport) {
            potentialFQNs.push(explicitImport);
        }
        if (packageName) {
            potentialFQNs.push(packageName + '.' + typeName);
        }
        for (const importName of importMatches) {
            if (importName.endsWith('.*')) {
                potentialFQNs.push(importName.slice(0, -2) + '.' + typeName);
            }
        }
        return potentialFQNs;
    }
}
