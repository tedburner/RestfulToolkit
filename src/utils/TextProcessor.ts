import * as vscode from 'vscode';

/**
 * 代码文本处理工具类
 *
 * 提供代码净化（去除字符串和注释干扰）和快速行号计算功能。
 * 用于提升解析器的准确性和性能。
 */
export class TextProcessor {
    private static textDecoder = new TextDecoder('utf-8');

    /**
     * 异步读取文件内容，避免阻塞 Extension Host。
     */
    static async readFileText(uri: vscode.Uri): Promise<string> {
        const fileData = await vscode.workspace.fs.readFile(uri);
        return this.textDecoder.decode(fileData);
    }
    /**
     * 代码净化：将字符串字面量和注释内容替换为等长空格。
     * 保持原始字符长度和换行符位置不变，确保字符索引完全对齐。
     *
     * 处理的内容：
     * - 双引号字符串 "..." （含转义 \"）
     * - 单引号字符 '.'
     * - 单行注释 // ...
     * - 多行注释 /* ... * /
     */
    static sanitize(code: string): string {
        const chars = code.split('');
        let i = 0;
        while (i < chars.length) {
            if (chars[i] === '"') {
                i = this.processQuoted(chars, '"', i);
                continue;
            }
            if (chars[i] === "'") {
                i = this.processQuoted(chars, "'", i);
                continue;
            }
            // 单行注释 //
            if (chars[i] === '/' && i + 1 < chars.length && chars[i + 1] === '/') {
                while (i < chars.length && chars[i] !== '\n') {
                    chars[i] = ' '; i++;
                }
                continue;
            }
            // 多行注释 /* */
            if (chars[i] === '/' && i + 1 < chars.length && chars[i + 1] === '*') {
                chars[i] = ' '; i++;
                chars[i] = ' '; i++;
                while (i < chars.length) {
                    if (chars[i] === '*' && i + 1 < chars.length && chars[i + 1] === '/') {
                        chars[i] = ' '; i++;
                        chars[i] = ' '; i++;
                        break;
                    }
                    if (chars[i] !== '\n') { chars[i] = ' '; }
                    i++;
                }
                continue;
            }
            i++;
        }
        return chars.join('');
    }

    private static processQuoted(chars: string[], quoteChar: string, start: number): number {
        let i = start + 1; // 跳过开头引号
        while (i < chars.length && chars[i] !== quoteChar) {
            if (chars[i] === '\\') {
                chars[i] = ' '; i++;
                if (i < chars.length && chars[i] !== '\n') { chars[i] = ' '; }
                i++;
                continue;
            }
            if (chars[i] !== '\n') { chars[i] = ' '; }
            i++;
        }
        if (i < chars.length) { i++; } // 跳过结尾引号
        return i;
    }

    /**
     * 预计算所有换行符的位置索引。
     * 返回数组，其中每个元素是一个 '\n' 字符的索引。
     */
    static buildLineIndex(code: string): number[] {
        const indices: number[] = [];
        for (let i = 0; i < code.length; i++) {
            if (code[i] === '\n') {
                indices.push(i);
            }
        }
        return indices;
    }

    /**
     * 使用二分查找获取字符索引对应的行号（1-based）。
     * 时间复杂度 O(log M)，M 为总行数。
     */
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
        return lo + 1; // 1-based 行号
    }

    /**
     * 兜底行号计算：通过 substring/split 获取行号。
     * 仅在未预计算 lineIndex 时使用，时间复杂度 O(N)。
     */
    static getLineNumberFallback(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }
}
