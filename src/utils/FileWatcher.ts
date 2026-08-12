import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/Logger';

/**
 * 监听工作区源码文件变化，并在分发事件前应用绝对或工作区相对排除规则。
 */
export class FileWatcher {
    private watchers: vscode.FileSystemWatcher[] = [];
    private logger: Logger;
    private onCreateHandler: ((uri: vscode.Uri) => void) | null = null;
    private onChangeHandler: ((uri: vscode.Uri) => void) | null = null;
    private onDeleteHandler: ((uri: vscode.Uri) => void) | null = null;
    private excludeMatchers: RegExp[] = [];

    constructor() {
        this.logger = Logger.getInstance();
    }

    setOnCreate(handler: (uri: vscode.Uri) => void): void {
        this.onCreateHandler = handler;
    }

    setOnChange(handler: (uri: vscode.Uri) => void): void {
        this.onChangeHandler = handler;
    }

    setOnDelete(handler: (uri: vscode.Uri) => void): void {
        this.onDeleteHandler = handler;
    }

    /**
     * 按扫描模式启动文件监听器。
     *
     * 排除规则同时匹配文件绝对路径和所属工作区的相对路径，以支持多根工作区及
     * `module/build/**` 这类项目相对配置。
     *
     * @param patterns 需要监听的源码 glob 模式
     * @param excludePatterns 不应分发事件的 glob 模式
     */
    start(patterns: string[], excludePatterns: string[] = []): void {
        this.stop();
        this.excludeMatchers = excludePatterns.flatMap(pattern => this.compileGlob(pattern));
        for (const pattern of patterns) {
            this.logger.info(`Starting file watcher for pattern: ${pattern}`);

            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidCreate(uri => {
                if (this.shouldIgnore(uri)) {
                    return;
                }

                if (this.onCreateHandler) {
                    this.onCreateHandler(uri);
                }
            });

            watcher.onDidChange(uri => {
                if (this.shouldIgnore(uri)) {
                    return;
                }

                if (this.onChangeHandler) {
                    this.onChangeHandler(uri);
                }
            });

            watcher.onDidDelete(uri => {
                if (this.shouldIgnore(uri)) {
                    return;
                }

                if (this.onDeleteHandler) {
                    this.onDeleteHandler(uri);
                }
            });

            this.watchers.push(watcher);
        }
    }

    stop(): void {
        for (const watcher of this.watchers) {
            watcher.dispose();
        }
        this.watchers = [];
    }

    private shouldIgnore(uri: vscode.Uri): boolean {
        const filePath = uri.fsPath;
        const normalized = filePath.replace(/\\/g, '/');
        if (/(?:^|\/)\.git(?:\/|$)/.test(normalized)) {
            return true;
        }

        const candidates = [normalized];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath).replace(/\\/g, '/');
            if (relativePath && relativePath !== '..' && !relativePath.startsWith('../')) {
                candidates.push(relativePath);
            }
        }

        return this.excludeMatchers.some(matcher =>
            candidates.some(candidate => matcher.test(candidate))
        );
    }

    private compileGlob(pattern: string): RegExp[] {
        try {
            return this.expandBraces(pattern).map(expanded => {
                const normalized = expanded.replace(/\\/g, '/');
                let source = '';
                for (let i = 0; i < normalized.length; i++) {
                    const char = normalized[i];
                    if (char === '*' && normalized[i + 1] === '*') {
                        i++;
                        if (normalized[i + 1] === '/') {
                            i++;
                            source += '(?:.*/)?';
                        } else {
                            source += '.*';
                        }
                    } else if (char === '*') {
                        source += '[^/]*';
                    } else if (char === '?') {
                        source += '[^/]';
                    } else {
                        source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                    }
                }
                return new RegExp(`^${source}$`);
            });
        } catch {
            return [];
        }
    }

    private expandBraces(pattern: string): string[] {
        const match = pattern.match(/\{([^{}]+)\}/);
        if (!match || match.index === undefined) {
            return [pattern];
        }
        const before = pattern.slice(0, match.index);
        const after = pattern.slice(match.index + match[0].length);
        return match[1].split(',').flatMap(option => this.expandBraces(before + option.trim() + after));
    }

    dispose(): void {
        this.stop();
    }
}
