import * as vscode from 'vscode';
import * as path from 'path';
import { DEFAULT_CONFIG, CONFIG_KEYS, PROJECT_CONFIG_FILE, ScanConfig } from './ScanConfig';
import { Logger } from '../utils/Logger';
import { BaseUrlResolver } from '../utils/BaseUrlResolver';

export class ConfigManager {
    private static instance: ConfigManager;
    private logger: Logger;
    private projectConfigs: Map<string, ScanConfig> = new Map();
    private workspaceFolders: string[] = [];
    /** 加载版本令牌：并发的旧一轮读取完成后不得覆盖新一轮结果 */
    private configLoadVersion = 0;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    async setWorkspaceFolder(folder: string): Promise<void> {
        await this.setWorkspaceFolders([folder]);
    }

    async setWorkspaceFolders(folders: string[]): Promise<void> {
        this.workspaceFolders = folders;
        await this.loadProjectConfigs();
    }

    /**
     * 异步加载项目配置文件，避免阻塞 Extension Host。
     *
     * 读取结果先积累到局部 Map，全部完成后按加载版本一次性替换共享快照；
     * 旧一轮异步读取在提交前发现版本已推进时直接丢弃，防止过期文件夹配置混入。
     */
    private async loadProjectConfigs(): Promise<void> {
        const loadVersion = ++this.configLoadVersion;
        const loaded = new Map<string, ScanConfig>();

        for (const folder of this.workspaceFolders) {
            const configPath = path.join(folder, PROJECT_CONFIG_FILE);
            try {
                const uri = vscode.Uri.file(configPath);
                const content = await vscode.workspace.fs.readFile(uri);
                const text = Buffer.from(content).toString('utf-8');
                const config = this.validateProjectConfig(this.safeJsonParse(text));
                if (config) {
                    loaded.set(folder, config);
                }
                this.logger.info(`Loaded project config from ${configPath}`);
            } catch (error) {
                if ((error as { code?: string })?.code === 'FileNotFound') {
                    this.logger.info(`No project config at ${configPath}`);
                } else {
                    const message = error instanceof Error ? error.message : String(error);
                    this.logger.warning(`Failed to load project config from ${configPath}: ${message}`);
                }
            }
        }

        if (loadVersion !== this.configLoadVersion) {
            this.logger.info('Discarding stale project config snapshot; a newer reload is in progress');
            return;
        }
        this.projectConfigs = loaded;
    }

    private safeJsonParse(content: string): unknown {
        return JSON.parse(content, (key, value) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                return undefined;
            }
            return value;
        });
    }

    private validateProjectConfig(config: unknown): ScanConfig | null {
        if (typeof config !== 'object' || config === null) {
            throw new Error('Project config must be an object');
        }

        const input = config as Record<string, unknown>;
        const validated: Partial<ScanConfig> = {};

        if (input.scanPaths !== undefined) {
            if (!this.isStringArray(input.scanPaths)) {
                throw new Error('scanPaths must be an array of strings');
            }
            validated.scanPaths = input.scanPaths;
        }

        if (input.excludePaths !== undefined) {
            if (!this.isStringArray(input.excludePaths)) {
                throw new Error('excludePaths must be an array of strings');
            }
            validated.excludePaths = input.excludePaths;
        }

        if (input.maxResults !== undefined) {
            if (typeof input.maxResults !== 'number' || !Number.isFinite(input.maxResults) || input.maxResults <= 0) {
                throw new Error('maxResults must be a positive number');
            }
            validated.maxResults = this.clampMaxResults(input.maxResults);
        }

        if (input.baseUrl !== undefined) {
            if (typeof input.baseUrl !== 'string') {
                throw new Error('baseUrl must be a string');
            }
            validated.baseUrl = input.baseUrl;
        }

        return validated as ScanConfig;
    }

    private isStringArray(value: unknown): value is string[] {
        return Array.isArray(value) && value.every(item => typeof item === 'string');
    }

    private clampMaxResults(value: number): number {
        return Math.min(1000, Math.max(1, Math.floor(value)));
    }

    /**
     * 获取有效扫描与运行配置；资源参数用于在多根工作区中选择对应文件夹的项目设置。
     * 全工作区扫描不传资源时仍合并各项目的扫描路径，标量配置按首个项目值兜底。
     *
     * @param resourceUri 可选的当前资源，用于选择所属工作区文件夹配置
     * @returns 按 VS Code 设置、项目配置、默认值优先级合成的配置
     */
    getScanConfig(resourceUri?: vscode.Uri): ScanConfig {
        const vsCodeConfig = vscode.workspace.getConfiguration('restfulToolkit', resourceUri);
        const workspaceFolder = this.getWorkspaceFolderForResource(resourceUri) ?? (!resourceUri ? this.workspaceFolders[0] : undefined);
        const projectConfig = workspaceFolder ? this.projectConfigs.get(workspaceFolder) : undefined;
        const vsCodeScanPaths = this.getExplicitVsCodeSetting<string[]>(vsCodeConfig, CONFIG_KEYS.scanPaths);
        const vsCodeExcludePaths = this.getExplicitVsCodeSetting<string[]>(vsCodeConfig, CONFIG_KEYS.excludePaths);
        const vsCodeMaxResults = this.getExplicitVsCodeSetting<number>(vsCodeConfig, CONFIG_KEYS.maxResults);
        const vsCodeBaseUrl = this.getExplicitVsCodeSetting<string>(vsCodeConfig, 'baseUrl');

        const config: ScanConfig = {
            scanPaths: vsCodeScanPaths ?? (resourceUri ? projectConfig?.scanPaths : this.mergeProjectArrays('scanPaths')) ?? DEFAULT_CONFIG.scanPaths,
            excludePaths: vsCodeExcludePaths ?? (resourceUri ? projectConfig?.excludePaths : this.mergeProjectArrays('excludePaths')) ?? DEFAULT_CONFIG.excludePaths,
            maxResults: this.clampMaxResults(vsCodeMaxResults ?? projectConfig?.maxResults ?? (!resourceUri ? this.firstProjectValue('maxResults') : undefined) ?? DEFAULT_CONFIG.maxResults),
            baseUrl: vsCodeBaseUrl ?? projectConfig?.baseUrl ?? (!resourceUri ? this.firstProjectValue('baseUrl') : undefined)
        };

        this.logger.info(`Effective scan config: scanPaths=${JSON.stringify(config.scanPaths)}`);

        return config;
    }

    private getExplicitVsCodeSetting<T>(config: vscode.WorkspaceConfiguration, key: string): T | undefined {
        const inspected = config.inspect<T>(key);
        return inspected?.workspaceFolderValue
            ?? inspected?.workspaceValue
            ?? inspected?.globalValue;
    }

    /**
     * 按工作区根目录分别合成扫描范围配置：folder 级 VS Code 设置 → 该根的项目配置 → 默认值。
     *
     * 多根工作区中各根的 scanPaths/excludePaths 互不合并，避免一个根的自定义
     * glob 顶掉另一个根的默认扫描模式。无根（未初始化）时返回空数组，调用方回退
     * 到 {@link getScanConfig} 的全局合并配置。
     */
    getFolderScanConfigs(): Array<{ folder: vscode.Uri; scanPaths: string[]; excludePaths: string[] }> {
        return this.workspaceFolders.map(folderPath => {
            const folderUri = vscode.Uri.file(folderPath);
            const vsCodeConfig = vscode.workspace.getConfiguration('restfulToolkit', folderUri);
            const vsCodeScanPaths = this.getExplicitVsCodeSetting<string[]>(vsCodeConfig, CONFIG_KEYS.scanPaths);
            const vsCodeExcludePaths = this.getExplicitVsCodeSetting<string[]>(vsCodeConfig, CONFIG_KEYS.excludePaths);
            const projectConfig = this.projectConfigs.get(folderPath);

            return {
                folder: folderUri,
                scanPaths: vsCodeScanPaths ?? projectConfig?.scanPaths ?? DEFAULT_CONFIG.scanPaths,
                excludePaths: vsCodeExcludePaths ?? projectConfig?.excludePaths ?? DEFAULT_CONFIG.excludePaths
            };
        });
    }

    private getProjectConfigs(): ScanConfig[] {
        return Array.from(this.projectConfigs.values());
    }

    private mergeProjectArrays(key: 'scanPaths' | 'excludePaths'): string[] | undefined {
        const merged: string[] = [];
        const seen = new Set<string>();

        for (const config of this.getProjectConfigs()) {
            const values = config[key];
            if (!values) {
                continue;
            }

            for (const value of values) {
                if (!seen.has(value)) {
                    seen.add(value);
                    merged.push(value);
                }
            }
        }

        return merged.length > 0 ? merged : undefined;
    }

    private firstProjectValue<K extends keyof ScanConfig>(key: K): ScanConfig[K] | undefined {
        for (const config of this.getProjectConfigs()) {
            const value = config[key];
            if (value !== undefined) {
                return value;
            }
        }
        return undefined;
    }

    static getDefaultConfig(): ScanConfig {
        return DEFAULT_CONFIG;
    }

    /**
     * 按“显式配置优先、工作区自动发现其次、默认地址兜底”的顺序异步解析 Base URL。
     *
     * @param resourceUri 当前命令关联的资源，用于多工作区场景选择所属工作区
     * @returns 可直接用于 URL 与 cURL 生成的 Base URL
     */
    async getBaseUrlAsync(resourceUri?: vscode.Uri): Promise<string> {
        const scanConfig = this.getScanConfig(resourceUri);
        if (scanConfig.baseUrl) { return scanConfig.baseUrl; }

        const workspaceFolder = this.getWorkspaceFolderForResource(resourceUri) ?? this.workspaceFolders[0];
        if (workspaceFolder) {
            const resolver = new BaseUrlResolver();
            const autoDetected = await resolver.resolveAsync(workspaceFolder);
            if (autoDetected) {
                const url = `http://${autoDetected.host}:${autoDetected.port}${autoDetected.contextPath}`;
                this.logger.info(`Auto-detected base URL: ${url}`);
                return url;
            }
        }

        return 'http://localhost:8080';
    }

    private getWorkspaceFolderForResource(resourceUri?: vscode.Uri): string | undefined {
        if (!resourceUri) {
            return undefined;
        }

        return vscode.workspace.getWorkspaceFolder(resourceUri)?.uri.fsPath;
    }

    async createProjectConfigTemplate(workspaceFolder: string): Promise<void> {
        const configPath = path.join(workspaceFolder, PROJECT_CONFIG_FILE);
        const configUri = vscode.Uri.file(configPath);

        if (await this.fileExists(configUri)) {
            this.logger.warning(`${PROJECT_CONFIG_FILE} already exists`);
            return;
        }

        const template = {
            scanPaths: DEFAULT_CONFIG.scanPaths,
            excludePaths: DEFAULT_CONFIG.excludePaths,
            maxResults: DEFAULT_CONFIG.maxResults,
            _comment: 'RestfulToolkit project configuration. Override default scan settings here.'
        };

        try {
            await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify(template, null, 2), 'utf-8'));
            this.logger.info(`Created ${PROJECT_CONFIG_FILE} template`);
            vscode.window.showInformationMessage(
                `Created ${PROJECT_CONFIG_FILE} in project root. You can customize scan settings.`
            );
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to create config template: ${err.message}`);
        }
    }

    private async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    static reset(): void {
        ConfigManager.instance = undefined as unknown as ConfigManager;
    }
}
