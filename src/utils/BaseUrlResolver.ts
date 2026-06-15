import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { Logger } from './Logger';

interface ResolvedBaseUrl {
    host: string;
    port: string;
    contextPath: string;
}

interface BaseUrlCacheEntry {
    signature: string;
    value: ResolvedBaseUrl | null;
}

/**
 * Base URL 自动检测器
 *
 * 支持：
 * - bootstrap.yml / bootstrap.properties（Spring Cloud，最高优先级）
 * - application.yml / application.properties（基础配置）
 * - application-{profile}.yml / application-{profile}.properties（多环境，覆盖基础配置）
 * - 占位符解析：${ENV_VAR:default} → default
 * - server.context-path（旧版）和 server.servlet.context-path（新版）
 */
export class BaseUrlResolver {
    private static readonly cache = new Map<string, BaseUrlCacheEntry>();
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * 自动检测 Base URL
     */
    resolve(workspaceFolder: string): ResolvedBaseUrl | null {
        const cacheKey = this.normalizePath(workspaceFolder);
        const resourcesDirs = this.findResourcesDirs(workspaceFolder);
        const files = resourcesDirs.flatMap(dir => this.collectConfigFiles(dir));
        const signature = this.buildConfigSignature(files);
        const cached = BaseUrlResolver.cache.get(cacheKey);
        if (cached && cached.signature === signature) {
            return this.cloneResult(cached.value);
        }

        const value = this.resolveFromConfigFiles(files);
        BaseUrlResolver.cache.set(cacheKey, { signature, value: this.cloneResult(value) });
        return value;
    }

    async resolveAsync(workspaceFolder: string): Promise<ResolvedBaseUrl | null> {
        const cacheKey = this.normalizePath(workspaceFolder);
        const resourcesDirs = await this.findResourcesDirsAsync(workspaceFolder);
        const files: string[] = [];
        for (const dir of resourcesDirs) {
            files.push(...await this.collectConfigFilesAsync(dir));
        }

        const signature = await this.buildConfigSignatureAsync(files);
        const cached = BaseUrlResolver.cache.get(cacheKey);
        if (cached && cached.signature === signature) {
            return this.cloneResult(cached.value);
        }

        const value = await this.resolveFromConfigFilesAsync(files);
        BaseUrlResolver.cache.set(cacheKey, { signature, value: this.cloneResult(value) });
        return value;
    }

    private resolveFromConfigFiles(files: string[]): ResolvedBaseUrl | null {
        if (files.length === 0) { return null; }
        const result: { port: string | null; contextPath: string | null } = { port: null, contextPath: null };

        for (const file of files) {
            const content = this.readFile(file);
            if (!content) { continue; }

            const parsed = file.endsWith('.properties')
                ? this.parseProperties(content)
                : this.parseYaml(content);

            if (parsed.port) {result.port = parsed.port;}
            if (parsed.contextPath) {result.contextPath = parsed.contextPath;}
        }

        if (!result.port && !result.contextPath) { return null; }

        return {
            host: 'localhost',
            port: result.port || '8080',
            contextPath: result.contextPath || ''
        };
    }

    private async resolveFromConfigFilesAsync(files: string[]): Promise<ResolvedBaseUrl | null> {
        if (files.length === 0) { return null; }
        const result: { port: string | null; contextPath: string | null } = { port: null, contextPath: null };

        for (const file of files) {
            const content = await this.readFileAsync(file);
            if (!content) { continue; }

            const parsed = file.endsWith('.properties')
                ? this.parseProperties(content)
                : this.parseYaml(content);

            if (parsed.port) { result.port = parsed.port; }
            if (parsed.contextPath) { result.contextPath = parsed.contextPath; }
        }

        if (!result.port && !result.contextPath) { return null; }

        return {
            host: 'localhost',
            port: result.port || '8080',
            contextPath: result.contextPath || ''
        };
    }

    private buildConfigSignature(files: string[]): string {
        return files.map(file => {
            try {
                const stats = fs.statSync(file);
                return `${this.normalizePath(file)}:${stats.mtimeMs}:${stats.ctimeMs}:${stats.size}`;
            } catch {
                return `${this.normalizePath(file)}:missing`;
            }
        }).join('|');
    }

    private async buildConfigSignatureAsync(files: string[]): Promise<string> {
        const parts: string[] = [];
        for (const file of files) {
            try {
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(file));
                parts.push(`${this.normalizePath(file)}:${stat.mtime}:${stat.ctime}:${stat.size}`);
            } catch {
                parts.push(`${this.normalizePath(file)}:missing`);
            }
        }
        return parts.join('|');
    }

    private cloneResult(value: ResolvedBaseUrl | null): ResolvedBaseUrl | null {
        return value ? { ...value } : null;
    }

    private normalizePath(filePath: string): string {
        return path.resolve(filePath).replace(/\\/g, '/');
    }

    /**
     * 查找所有 src/main/resources 目录（支持多模块 Maven/Gradle 项目）
     */
    private findResourcesDirs(root: string): string[] {
        const results: string[] = [];
        this.searchDir(root, root, results, 0);
        return results;
    }

    private async findResourcesDirsAsync(root: string): Promise<string[]> {
        const results: string[] = [];
        await this.searchDirAsync(root, results, 0);
        return results;
    }

    private searchDir(root: string, dir: string, results: string[], depth: number) {
        if (depth > 5) {return;}
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === 'resources' && dir.endsWith('main')) {
                        results.push(fullPath);
                    } else if (!this.isExcludedDir(entry.name)) {
                        this.searchDir(root, fullPath, results, depth + 1);
                    }
                }
            }
        } catch {
            // 忽略权限错误等
        }
    }

    private isExcludedDir(name: string): boolean {
        const excluded = ['node_modules', 'target', 'build', '.git', '.idea', '.gradle', 'dist', 'out'];
        return excluded.includes(name);
    }

    private async searchDirAsync(dir: string, results: string[], depth: number): Promise<void> {
        if (depth > 5) { return; }
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, fileType] of entries) {
                if (fileType !== vscode.FileType.Directory) {
                    continue;
                }

                const fullPath = path.join(dir, name);
                if (name === 'resources' && dir.endsWith('main')) {
                    results.push(fullPath);
                } else if (!this.isExcludedDir(name)) {
                    await this.searchDirAsync(fullPath, results, depth + 1);
                }
            }
        } catch {
            // Ignore inaccessible folders.
        }
    }

    /**
     * 按 Spring Boot 优先级收集配置文件（共享算法）：
     * 1. application.properties / application.yml（最低优先级）
     * 2. bootstrap.properties / bootstrap.yml（Spring Cloud，高优先级）
     * 3. application-{profile}.*（按字母序，最高优先级，覆盖前面的）
     */
    private buildConfigFileList(names: Set<string>, resourcesDir: string): string[] {
        const files: string[] = [];

        // application.*（基础配置）
        if (names.has('application.properties')) { files.push(path.join(resourcesDir, 'application.properties')); }
        if (names.has('application.yml')) { files.push(path.join(resourcesDir, 'application.yml')); }
        if (names.has('application.yaml')) { files.push(path.join(resourcesDir, 'application.yaml')); }

        // bootstrap.*（Spring Cloud，优先级高于 application）
        if (names.has('bootstrap.properties')) { files.push(path.join(resourcesDir, 'bootstrap.properties')); }
        if (names.has('bootstrap.yml')) { files.push(path.join(resourcesDir, 'bootstrap.yml')); }
        if (names.has('bootstrap.yaml')) { files.push(path.join(resourcesDir, 'bootstrap.yaml')); }

        // application-{profile}.*（最高优先级）
        const profileFiles: string[] = [];
        for (const name of names) {
            if (/^application-(?!yml$|yaml$|properties$).+\.(yml|yaml|properties)$/.test(name)) {
                profileFiles.push(name);
            }
        }
        profileFiles.sort();
        for (const name of profileFiles) {
            files.push(path.join(resourcesDir, name));
        }

        return files;
    }

    private collectConfigFiles(resourcesDir: string): string[] {
        try {
            const entries = fs.readdirSync(resourcesDir, { withFileTypes: true });
            const names = new Set(entries.filter(e => e.isFile()).map(e => e.name));
            return this.buildConfigFileList(names, resourcesDir);
        } catch {
            return [];
        }
    }

    private async collectConfigFilesAsync(resourcesDir: string): Promise<string[]> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(resourcesDir));
            const names = new Set(entries
                .filter(([, fileType]) => fileType === vscode.FileType.File)
                .map(([name]) => name));
            return this.buildConfigFileList(names, resourcesDir);
        } catch {
            return [];
        }
    }

    private readFile(filePath: string): string | null {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch {
            return null;
        }
    }

    private async readFileAsync(filePath: string): Promise<string | null> {
        try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            return Buffer.from(bytes).toString('utf-8');
        } catch {
            return null;
        }
    }

    /**
     * 解析 YAML 内容
     */
    private parseYaml(content: string): { port: string | null; contextPath: string | null } {
        let port: string | null = null;
        let contextPath: string | null = null;

        // 匹配 server: 块下的 port: （处理嵌套 YAML）
        const serverBlock = this.extractYamlBlock(content, 'server');
        if (serverBlock) {
            const portMatch = serverBlock.match(/(?:^|\n)\s*port:\s*(.+)$/m);
            if (portMatch) {
                port = this.cleanValue(portMatch[1]);
            }

            // server.servlet.context-path 或 server.context-path
            const servletBlock = this.extractYamlBlock(serverBlock, 'servlet');
            if (servletBlock) {
                const ctxMatch = servletBlock.match(/(?:^|\n)\s*context-path:\s*(.+)$/m);
                if (ctxMatch) {
                    contextPath = this.cleanValue(ctxMatch[1]);
                }
            }
            // 旧版 server.context-path（直接在 server 下）
            if (!contextPath) {
                const ctxMatch = serverBlock.match(/(?:^|\n)\s*context-path:\s*(.+)$/m);
                if (ctxMatch) {
                    contextPath = this.cleanValue(ctxMatch[1]);
                }
            }
        }

        // 兜底：仅允许顶层 server.port，避免误读 management.server.port 等其它层级
        if (!port) {
            const portMatch = content.match(/^server\.port\s*:\s*(.+)$/m);
            if (portMatch) { port = this.cleanValue(portMatch[1]); }
        }

        return { port, contextPath };
    }

    /**
     * 从 YAML 中提取指定键下的块
     */
    private extractYamlBlock(content: string, key: string): string | null {
        const lines = content.split('\n');
        let keyIndent: number | null = null;
        const blockLines: string[] = [];
        let foundKey = false;

        for (const line of lines) {
            if (!foundKey) {
                // 找 key: 行
                const match = line.match(new RegExp(`^(\\s*)${key}:\\s*(.*)$`));
                if (!match) { continue; }
                keyIndent = match[1].length;
                foundKey = true;
                const inlineValue = match[2].trim();
                // 内联值（如 server: port: 8080）
                if (inlineValue) { return inlineValue; }
                continue;
            }
            // 找到 key 后，收集所有更深缩进的行
            if (line.trim() === '') { blockLines.push(line); continue; }
            const indentMatch = line.match(/^(\s*)/);
            const lineIndent = indentMatch ? indentMatch[1].length : 0;
            if (lineIndent > keyIndent!) {
                blockLines.push(line);
            } else {
                // 同级或更浅缩进 → 块结束
                break;
            }
        }

        return blockLines.length > 0 ? blockLines.join('\n') : null;
    }

    /**
     * 解析 Properties 内容
     */
    private parseProperties(content: string): { port: string | null; contextPath: string | null } {
        let port: string | null = null;
        let contextPath: string | null = null;

        const portMatch = content.match(/^server\.port\s*=\s*(.+)$/m);
        if (portMatch) { port = this.cleanValue(portMatch[1]); }

        // 新版 server.servlet.context-path 或旧版 server.context-path
        const servletCtxMatch = content.match(/^server\.servlet\.context-path\s*=\s*(.+)$/m);
        if (servletCtxMatch) { contextPath = this.cleanValue(servletCtxMatch[1]); }
        if (!contextPath) {
            const ctxMatch = content.match(/^server\.context-path\s*=\s*(.+)$/m);
            if (ctxMatch) { contextPath = this.cleanValue(ctxMatch[1]); }
        }

        return { port, contextPath };
    }

    /**
     * 清理值：去除引号、解析占位符默认值
     *
     * 占位符格式：
     * - ${ENV_VAR:default} → default
     * - ${env.VAR:8080} → 8080
     * - ${server.port} → null（无默认值，跳过）
     */
    private cleanValue(value: string): string | null {
        let cleaned = value.trim().replace(/^["']|["']$/g, '');

        // 解析占位符：${...:default}
        const placeholderMatch = cleaned.match(/^\$\{[^}]*:(.+?)\}$/);
        if (placeholderMatch) {
            cleaned = placeholderMatch[1];
        } else if (cleaned.includes('${')) {
            // 有占位符但没有默认值，跳过
            return null;
        }

        // 只接受纯字母数字、点号、斜杠、连字符的值
        if (!/^[\w.\-/]+$/.test(cleaned)) { return null; }

        return cleaned;
    }
}
