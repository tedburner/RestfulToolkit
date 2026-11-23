import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { isCaseInsensitivePlatform, normalizePathKey, relativeFromFolder, toPosixPath } from './PathUtils';

/** 单个工作区根的监听作用域；folderUri 缺省时表示全局监听。 */
export interface WatcherScope {
    folderUri?: vscode.Uri;
    patterns: string[];
    excludePatterns: string[];
}

interface CompiledScope {
    folderFsPath?: string;
    folderKey?: string;
    watchers: vscode.FileSystemWatcher[];
    excludeMatchers: RegExp[];
}

/**
 * 监听工作区源码文件变化，并在分发事件前应用所属根目录的排除规则。
 *
 * 多根工作区按根目录分别创建监听器并应用各自的 excludePatterns；事件归属的
 * 根由 VS Code workspace folder 判定，全局作用域作为无匹配时的回退。
 */
export class FileWatcher {
    private scopes: CompiledScope[] = [];
    private logger: Logger;
    private onCreateHandler: ((uri: vscode.Uri) => void) | null = null;
    private onChangeHandler: ((uri: vscode.Uri) => void) | null = null;
    private onDeleteHandler: ((uri: vscode.Uri) => void) | null = null;

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
     * `module/build/**` 这类项目相对配置；每个作用域只应用自己配置的规则。
     *
     * @param scopes 各工作区根的监听模式与排除规则
     */
    start(scopes: WatcherScope[]): void {
        this.stop();

        for (const scope of scopes) {
            const compiled: CompiledScope = {
                folderFsPath: scope.folderUri?.fsPath,
                folderKey: scope.folderUri ? normalizePathKey(scope.folderUri.fsPath) : undefined,
                watchers: [],
                excludeMatchers: scope.excludePatterns.flatMap(pattern => this.compileGlob(pattern))
            };

            for (const pattern of scope.patterns) {
                this.logger.info(`Starting file watcher for pattern: ${pattern} (${scope.folderUri?.fsPath ?? 'workspace'})`);

                const globPattern = scope.folderUri
                    ? new vscode.RelativePattern(scope.folderUri, pattern)
                    : pattern;
                const watcher = vscode.workspace.createFileSystemWatcher(globPattern);

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

                compiled.watchers.push(watcher);
            }

            this.scopes.push(compiled);
        }
    }

    stop(): void {
        for (const scope of this.scopes) {
            for (const watcher of scope.watchers) {
                watcher.dispose();
            }
        }
        this.scopes = [];
    }

    private shouldIgnore(uri: vscode.Uri): boolean {
        const filePath = uri.fsPath;
        const normalized = toPosixPath(filePath);
        if (/(?:^|\/)\.git(?:\/|$)/i.test(normalized)) {
            return true;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const workspaceKey = workspaceFolder ? normalizePathKey(workspaceFolder.uri.fsPath) : undefined;
        const owningScope = workspaceKey
            ? this.scopes.find(scope => scope.folderKey === workspaceKey)
                ?? this.scopes.find(scope => scope.folderFsPath === undefined)
            : this.scopes.find(scope => scope.folderFsPath === undefined);

        if (!owningScope) {
            this.logger.debug(`No watcher scope owns ${filePath}; exclude rules skipped`);
            return false;
        }

        const candidates = [normalized];
        if (workspaceFolder) {
            const relativePath = relativeFromFolder(workspaceFolder.uri.fsPath, filePath);
            if (relativePath) {
                candidates.push(relativePath);
            }
        }

        return owningScope.excludeMatchers.some(matcher =>
            candidates.some(candidate => matcher.test(candidate))
        );
    }

    private compileGlob(pattern: string): RegExp[] {
        try {
            const flags = isCaseInsensitivePlatform() ? 'i' : '';
            return this.expandBraces(pattern).map(expanded => {
                const normalized = toPosixPath(expanded);
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
                return new RegExp(`^${source}$`, flags);
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
