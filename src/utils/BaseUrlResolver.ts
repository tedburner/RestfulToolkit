import * as path from 'path';
import * as fs from 'fs';
import { Logger } from './Logger';

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
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * 自动检测 Base URL
     */
    resolve(workspaceFolder: string): { host: string; port: string; contextPath: string } | null {
        const resourcesDirs = this.findResourcesDirs(workspaceFolder);
        if (resourcesDirs.length === 0) { return null; }

        const result: { port: string | null; contextPath: string | null } = { port: null, contextPath: null };

        for (const dir of resourcesDirs) {
            const files = this.collectConfigFiles(dir);
            for (const file of files) {
                const content = this.readFile(file);
                if (!content) { continue; }

                const parsed = file.endsWith('.properties')
                    ? this.parseProperties(content)
                    : this.parseYaml(content);

                if (parsed.port) {result.port = parsed.port;}
                if (parsed.contextPath) {result.contextPath = parsed.contextPath;}
            }
        }

        if (!result.port && !result.contextPath) { return null; }

        return {
            host: 'localhost',
            port: result.port || '8080',
            contextPath: result.contextPath || ''
        };
    }

    /**
     * 查找所有 src/main/resources 目录（支持多模块 Maven/Gradle 项目）
     */
    private findResourcesDirs(root: string): string[] {
        const results: string[] = [];
        this.searchDir(root, root, results, 0);
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

    /**
     * 按 Spring Boot 优先级收集配置文件：
     * 1. application.properties / application.yml（最低优先级）
     * 2. bootstrap.properties / bootstrap.yml（Spring Cloud，高优先级）
     * 3. application-{profile}.*（按字母序，最高优先级，覆盖前面的）
     *
     * 后面的值覆盖前面的。
     */
    private collectConfigFiles(resourcesDir: string): string[] {
        const files: string[] = [];
        try {
            const entries = fs.readdirSync(resourcesDir, { withFileTypes: true });
            const names = new Set(entries.filter(e => e.isFile()).map(e => e.name));

            // application.*（基础配置）
            if (names.has('application.properties')) {files.push(path.join(resourcesDir, 'application.properties'));}
            if (names.has('application.yml')) {files.push(path.join(resourcesDir, 'application.yml'));}
            if (names.has('application.yaml')) {files.push(path.join(resourcesDir, 'application.yaml'));}

            // bootstrap.*（Spring Cloud，优先级高于 application）
            if (names.has('bootstrap.properties')) {files.push(path.join(resourcesDir, 'bootstrap.properties'));}
            if (names.has('bootstrap.yml')) {files.push(path.join(resourcesDir, 'bootstrap.yml'));}
            if (names.has('bootstrap.yaml')) {files.push(path.join(resourcesDir, 'bootstrap.yaml'));}

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
        } catch {
            // 忽略
        }

        return files;
    }

    private readFile(filePath: string): string | null {
        try {
            return fs.readFileSync(filePath, 'utf-8');
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

        // 兜底：简单正则匹配（处理单行 YAML 或格式不规范的情况）
        if (!port) {
            const portMatch = content.match(/port:\s*(.+)$/m);
            if (portMatch) { port = this.cleanValue(portMatch[1]); }
        }
        if (!contextPath) {
            const ctxMatch = content.match(/context-path:\s*(.+)$/m);
            if (ctxMatch) { contextPath = this.cleanValue(ctxMatch[1]); }
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
