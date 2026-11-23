import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from './Logger';
import { normalizePathKey, relativeFromFolder, toPosixPath } from './PathUtils';

interface ResolvedBaseUrl {
    host: string;
    port: string;
    contextPath: string;
}

interface ModuleBaseUrlEntry {
    moduleRoot: string;
    value: ResolvedBaseUrl | null;
}

interface WorkspaceBaseUrlSnapshot {
    modules: ModuleBaseUrlEntry[];
    merged: ResolvedBaseUrl | null;
}

interface InflightResolution {
    epoch: number;
    generation: number;
    promise: Promise<WorkspaceBaseUrlSnapshot>;
}

interface ConfigValues {
    port: string | null;
    contextPath: string | null;
    hasExplicitContextPath: boolean;
    activeProfiles: string[];
}

/**
 * Base URL 自动检测器
 *
 * 支持：
 * - bootstrap.yml / bootstrap.properties（Spring Cloud，高优先级）
 * - application.yml / application.properties（基础配置）
 * - application-{profile}.yml / application-{profile}.properties（遵循 spring.profiles.active，未声明时按字母序覆盖）
 * - 占位符解析：${ENV_VAR:default} → default
 * - server.context-path（旧版）和 server.servlet.context-path（新版），忽略 management.server 等非顶层块及行尾 # 注释
 * - 多模块项目按当前资源路径就近匹配所属子模块配置
 */
export class BaseUrlResolver {
    private static readonly cache = new Map<string, WorkspaceBaseUrlSnapshot>();
    private static readonly generations = new Map<string, number>();
    private static readonly inflightResolutions = new Map<string, InflightResolution>();
    private static cacheEpoch = 0;
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * 异步发现并解析工作区内的 Spring Boot Base URL 配置。
     *
     * @param workspaceFolder 工作区根目录
     * @param resourcePath 可选的当前控制器文件路径，用于在多模块工作区中就近选择子模块配置
     * @returns 自动识别的主机、端口和上下文路径；未发现有效配置时返回 null
     */
    async resolveAsync(workspaceFolder: string, resourcePath?: string): Promise<ResolvedBaseUrl | null> {
        const cacheKey = BaseUrlResolver.normalizePath(workspaceFolder);
        const cached = BaseUrlResolver.cache.get(cacheKey);
        if (cached) {
            return this.selectModuleResult(cached, resourcePath);
        }

        const cacheEpoch = BaseUrlResolver.cacheEpoch;
        const generation = BaseUrlResolver.generations.get(cacheKey) ?? 0;

        const inflight = BaseUrlResolver.inflightResolutions.get(cacheKey);
        if (inflight && inflight.epoch === cacheEpoch && inflight.generation === generation) {
            const snapshot = await inflight.promise;
            return this.selectModuleResult(snapshot, resourcePath);
        }

        const discovery = this.discoverAndResolveSnapshot(workspaceFolder);
        BaseUrlResolver.inflightResolutions.set(cacheKey, { epoch: cacheEpoch, generation, promise: discovery });
        const snapshot = await discovery.finally(() => {
            const current = BaseUrlResolver.inflightResolutions.get(cacheKey);
            if (current && current.promise === discovery) {
                BaseUrlResolver.inflightResolutions.delete(cacheKey);
            }
        });

        if (cacheEpoch === BaseUrlResolver.cacheEpoch
            && generation === (BaseUrlResolver.generations.get(cacheKey) ?? 0)) {
            BaseUrlResolver.cache.set(cacheKey, this.cloneSnapshot(snapshot));
        }
        return this.selectModuleResult(snapshot, resourcePath);
    }

    static invalidate(workspaceFolder: string): void {
        const cacheKey = BaseUrlResolver.normalizePath(workspaceFolder);
        BaseUrlResolver.cache.delete(cacheKey);
        BaseUrlResolver.inflightResolutions.delete(cacheKey);
        BaseUrlResolver.generations.set(cacheKey, (BaseUrlResolver.generations.get(cacheKey) ?? 0) + 1);
    }

    static reset(): void {
        BaseUrlResolver.cache.clear();
        BaseUrlResolver.generations.clear();
        BaseUrlResolver.inflightResolutions.clear();
        BaseUrlResolver.cacheEpoch++;
    }

    private selectModuleResult(snapshot: WorkspaceBaseUrlSnapshot, resourcePath?: string): ResolvedBaseUrl | null {
        if (resourcePath && snapshot.modules.length > 0) {
            const matching = snapshot.modules
                .filter(entry => entry.value !== null && relativeFromFolder(entry.moduleRoot, resourcePath) !== null)
                .sort((a, b) => b.moduleRoot.length - a.moduleRoot.length);
            if (matching.length > 0) {
                return this.cloneResult(matching[0].value);
            }
        }
        return this.cloneResult(snapshot.merged);
    }

    private async discoverAndResolveSnapshot(workspaceFolder: string): Promise<WorkspaceBaseUrlSnapshot> {
        const resourcesDirs = await this.findResourcesDirsAsync(workspaceFolder);
        if (resourcesDirs.length === 0) {
            return { modules: [], merged: null };
        }

        const modules: ModuleBaseUrlEntry[] = [];
        const mergedValues: ConfigValues = {
            port: null,
            contextPath: null,
            hasExplicitContextPath: false,
            activeProfiles: []
        };

        for (const dir of resourcesDirs) {
            const moduleValues = await this.resolveResourcesDirAsync(dir);
            if (moduleValues.port) {
                mergedValues.port = moduleValues.port;
            }
            if (moduleValues.hasExplicitContextPath) {
                mergedValues.contextPath = moduleValues.contextPath;
                mergedValues.hasExplicitContextPath = true;
            }
            modules.push({
                moduleRoot: this.deriveModuleRoot(dir),
                value: this.toResolvedBaseUrl(moduleValues)
            });
        }

        return {
            modules,
            merged: this.toResolvedBaseUrl(mergedValues)
        };
    }

    private deriveModuleRoot(resourcesDir: string): string {
        const posix = toPosixPath(resourcesDir).replace(/\/+$/, '');
        if (posix.endsWith('/src/main/resources')) {
            return path.dirname(path.dirname(path.dirname(resourcesDir)));
        }
        if (posix.endsWith('/main/resources')) {
            return path.dirname(path.dirname(resourcesDir));
        }
        return path.dirname(resourcesDir);
    }

    private async resolveResourcesDirAsync(resourcesDir: string): Promise<ConfigValues> {
        const result: ConfigValues = {
            port: null,
            contextPath: null,
            hasExplicitContextPath: false,
            activeProfiles: []
        };

        let names: Set<string>;
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(resourcesDir));
            names = new Set(entries
                .filter(([, fileType]) => fileType === vscode.FileType.File)
                .map(([name]) => name));
        } catch {
            return result;
        }

        const baseFiles: string[] = [];
        for (const baseName of [
            'application.properties', 'application.yml', 'application.yaml',
            'bootstrap.properties', 'bootstrap.yml', 'bootstrap.yaml'
        ]) {
            if (names.has(baseName)) {
                baseFiles.push(path.join(resourcesDir, baseName));
            }
        }

        for (const file of baseFiles) {
            const content = await this.readFileAsync(file);
            if (!content) { continue; }
            this.applyConfigValues(result, file, content, true);
        }

        const profileFiles = this.selectProfileFiles(names, resourcesDir, result.activeProfiles);
        for (const file of profileFiles) {
            const content = await this.readFileAsync(file);
            if (!content) { continue; }
            this.applyConfigValues(result, file, content, false);
        }

        return result;
    }

    private selectProfileFiles(names: Set<string>, resourcesDir: string, activeProfiles: string[]): string[] {
        if (activeProfiles.length > 0) {
            const selected: string[] = [];
            for (const profile of activeProfiles) {
                for (const ext of ['properties', 'yml', 'yaml']) {
                    const candidate = `application-${profile}.${ext}`;
                    if (names.has(candidate)) {
                        selected.push(path.join(resourcesDir, candidate));
                    }
                }
            }
            return selected;
        }

        const profileNames: string[] = [];
        for (const name of names) {
            if (/^application-(?!yml$|yaml$|properties$).+\.(yml|yaml|properties)$/.test(name)) {
                profileNames.push(name);
            }
        }
        profileNames.sort();
        return profileNames.map(name => path.join(resourcesDir, name));
    }

    private applyConfigValues(result: ConfigValues, file: string, content: string, readActiveProfiles: boolean): void {
        const parsed = file.endsWith('.properties')
            ? this.parseProperties(content)
            : this.parseYaml(content);
        if (parsed.port) { result.port = parsed.port; }
        if (parsed.contextPath !== null) {
            result.contextPath = this.normalizeContextPath(parsed.contextPath);
            result.hasExplicitContextPath = true;
        }
        if (readActiveProfiles && parsed.activeProfiles.length > 0) {
            result.activeProfiles = parsed.activeProfiles;
        }
    }

    private normalizeContextPath(raw: string): string {
        const trimmed = raw.replace(/^\/+|\/+$/g, '');
        return trimmed ? `/${trimmed}` : '';
    }

    private toResolvedBaseUrl(result: ConfigValues): ResolvedBaseUrl | null {
        if (!result.port && !result.hasExplicitContextPath) { return null; }
        return {
            host: 'localhost',
            port: result.port || '8080',
            contextPath: result.contextPath || ''
        };
    }

    private cloneSnapshot(snapshot: WorkspaceBaseUrlSnapshot): WorkspaceBaseUrlSnapshot {
        return {
            modules: snapshot.modules.map(m => ({ moduleRoot: m.moduleRoot, value: this.cloneResult(m.value) })),
            merged: this.cloneResult(snapshot.merged)
        };
    }

    private cloneResult(value: ResolvedBaseUrl | null): ResolvedBaseUrl | null {
        return value ? { ...value } : null;
    }

    private static normalizePath(filePath: string): string {
        return normalizePathKey(path.resolve(filePath));
    }

    /**
     * 查找所有 src/main/resources 目录（支持多模块 Maven/Gradle 项目，同层并行读取并保持稳定排序）
     */
    private async findResourcesDirsAsync(root: string): Promise<string[]> {
        return this.searchDirAsync(root, 0);
    }

    private isExcludedDir(name: string): boolean {
        const excluded = ['node_modules', 'target', 'build', '.git', '.idea', '.gradle', 'dist', 'out'];
        return excluded.includes(name);
    }

    private async searchDirAsync(dir: string, depth: number): Promise<string[]> {
        if (depth > 5) { return []; }
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            const sortedDirs = entries
                .filter(([, fileType]) => fileType === vscode.FileType.Directory)
                .map(([name]) => name)
                .sort();

            const childPromises = sortedDirs.map(async (name): Promise<string[]> => {
                const fullPath = path.join(dir, name);
                if (name === 'resources' && dir.endsWith('main')) {
                    return [fullPath];
                }
                if (!this.isExcludedDir(name)) {
                    return this.searchDirAsync(fullPath, depth + 1);
                }
                return [];
            });

            const nestedResults = await Promise.all(childPromises);
            return nestedResults.flat();
        } catch {
            return [];
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
     * 解析 YAML 内容（仅顶层 server 块生效，支持行尾 # 注释与 spring.profiles.active）
     */
    private parseYaml(content: string): { port: string | null; contextPath: string | null; activeProfiles: string[] } {
        let port: string | null = null;
        let contextPath: string | null = null;

        // 仅匹配顶层（indent = 0）的 server: 块，防止被 management.server 等嵌套块劫持
        const serverBlock = this.extractYamlBlock(content, 'server', 0);
        if (serverBlock) {
            const portMatch = serverBlock.match(/(?:^|\n)\s*port:\s*(.+)$/m);
            if (portMatch) {
                port = this.cleanValue(portMatch[1]);
            }

            const servletBlock = this.extractYamlBlock(serverBlock, 'servlet', null);
            if (servletBlock) {
                const ctxMatch = servletBlock.match(/(?:^|\n)\s*context-path:\s*(.+)$/m);
                if (ctxMatch) {
                    contextPath = this.cleanValue(ctxMatch[1]);
                }
            }
            if (contextPath === null) {
                const ctxMatch = serverBlock.match(/(?:^|\n)\s*context-path:\s*(.+)$/m);
                if (ctxMatch) {
                    contextPath = this.cleanValue(ctxMatch[1]);
                }
            }
        }

        if (!port) {
            const portMatch = content.match(/^server\.port\s*:\s*(.+)$/m);
            if (portMatch) { port = this.cleanValue(portMatch[1]); }
        }

        if (contextPath === null) {
            const flatServletCtx = content.match(/^server\.servlet\.context-path\s*:\s*(.+)$/m);
            if (flatServletCtx) {
                contextPath = this.cleanValue(flatServletCtx[1]);
            } else {
                const flatCtx = content.match(/^server\.context-path\s*:\s*(.+)$/m);
                if (flatCtx) { contextPath = this.cleanValue(flatCtx[1]); }
            }
        }

        const activeProfiles = this.extractYamlActiveProfiles(content);
        return { port, contextPath, activeProfiles };
    }

    private extractYamlActiveProfiles(content: string): string[] {
        let rawActive: string | null = null;
        const springBlock = this.extractYamlBlock(content, 'spring', 0);
        if (springBlock) {
            const profilesBlock = this.extractYamlBlock(springBlock, 'profiles', null);
            if (profilesBlock) {
                const activeMatch = profilesBlock.match(/(?:^|\n)\s*active:\s*(.+)$/m);
                if (activeMatch) {
                    rawActive = activeMatch[1];
                }
            }
        }
        if (!rawActive) {
            const flatMatch = content.match(/^spring\.profiles\.active\s*:\s*(.+)$/m);
            if (flatMatch) {
                rawActive = flatMatch[1];
            }
        }
        return rawActive ? this.parseProfileList(rawActive) : [];
    }

    /**
     * 从 YAML 中提取指定键下的块；expectedIndent 非 null 时严格要求该键处于对应缩进层级。
     */
    private extractYamlBlock(content: string, key: string, expectedIndent: number | null): string | null {
        const lines = content.split('\n');
        let keyIndent: number | null = null;
        const blockLines: string[] = [];
        let foundKey = false;
        const keyPattern = new RegExp(`^(\\s*)${key}:\\s*(.*)$`);

        for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '');
            const trimmed = line.trim();
            if (!foundKey) {
                if (!trimmed || trimmed.startsWith('#')) { continue; }
                const match = line.match(keyPattern);
                if (!match) { continue; }
                const indent = match[1].length;
                if (expectedIndent !== null && indent !== expectedIndent) {
                    continue;
                }
                keyIndent = indent;
                foundKey = true;
                const inlineValue = this.stripInlineComment(match[2]).trim();
                if (inlineValue) { return inlineValue; }
                continue;
            }
            if (trimmed === '' || trimmed.startsWith('#')) {
                blockLines.push(line);
                continue;
            }
            const indentMatch = line.match(/^(\s*)/);
            const lineIndent = indentMatch ? indentMatch[1].length : 0;
            if (lineIndent > keyIndent!) {
                blockLines.push(line);
            } else {
                break;
            }
        }

        return blockLines.length > 0 ? blockLines.join('\n') : null;
    }

    private parseProperties(content: string): { port: string | null; contextPath: string | null; activeProfiles: string[] } {
        let port: string | null = null;
        let contextPath: string | null = null;

        const portMatch = content.match(/^server\.port\s*=\s*(.+)$/m);
        if (portMatch) { port = this.cleanValue(portMatch[1]); }

        const servletCtxMatch = content.match(/^server\.servlet\.context-path\s*=\s*(.+)$/m);
        if (servletCtxMatch) { contextPath = this.cleanValue(servletCtxMatch[1]); }
        if (contextPath === null) {
            const ctxMatch = content.match(/^server\.context-path\s*=\s*(.+)$/m);
            if (ctxMatch) { contextPath = this.cleanValue(ctxMatch[1]); }
        }

        const activeMatch = content.match(/^spring\.profiles\.active\s*=\s*(.+)$/m);
        const activeProfiles = activeMatch ? this.parseProfileList(activeMatch[1]) : [];

        return { port, contextPath, activeProfiles };
    }

    private parseProfileList(rawValue: string): string[] {
        const stripped = this.stripInlineComment(rawValue).trim().replace(/^["']|["']$/g, '');
        const resolved = this.resolvePlaceholder(stripped);
        if (!resolved) {
            return [];
        }
        return resolved
            .split(',')
            .map(item => item.trim())
            .filter(item => /^[\w.-]+$/.test(item));
    }

    /**
     * 剥离引号外的行尾 `#` 注释（YAML 规范要求 `#` 在行首或紧跟空白后才视作注释）。
     */
    private stripInlineComment(raw: string): string {
        let inQuote: string | null = null;
        for (let i = 0; i < raw.length; i++) {
            const ch = raw[i];
            if (inQuote) {
                if (ch === '\\' && inQuote === '"') {
                    i++;
                    continue;
                }
                if (ch === inQuote) {
                    inQuote = null;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                inQuote = ch;
                continue;
            }
            if (ch === '#' && (i === 0 || /\s/.test(raw[i - 1]))) {
                return raw.slice(0, i).trim();
            }
        }
        return raw.trim();
    }

    private resolvePlaceholder(value: string): string | null {
        const placeholderMatch = value.match(/^\$\{[^}]*:(.+?)\}$/);
        if (placeholderMatch) {
            return placeholderMatch[1].trim();
        }
        if (value.includes('${')) {
            return null;
        }
        return value;
    }

    private cleanValue(value: string): string | null {
        const withoutComment = this.stripInlineComment(value);
        const unquoted = withoutComment.replace(/^["']|["']$/g, '').trim();
        const cleaned = this.resolvePlaceholder(unquoted);
        if (!cleaned) {
            return null;
        }
        if (!/^[\w.\-/]+$/.test(cleaned)) { return null; }

        return cleaned;
    }
}
