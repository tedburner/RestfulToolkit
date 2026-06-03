import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DEFAULT_CONFIG, CONFIG_KEYS, PROJECT_CONFIG_FILE, ScanConfig } from './ScanConfig';
import { Logger } from '../utils/Logger';
import { BaseUrlResolver } from '../utils/BaseUrlResolver';

export class ConfigManager {
    private static instance: ConfigManager;
    private logger: Logger;
    private projectConfigs: Map<string, ScanConfig> = new Map();
    private workspaceFolders: string[] = [];

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
     * 异步加载项目配置文件，避免阻塞 Extension Host
     */
    private async loadProjectConfigs(): Promise<void> {
        this.projectConfigs.clear();

        for (const folder of this.workspaceFolders) {
            const configPath = path.join(folder, PROJECT_CONFIG_FILE);
            try {
                const uri = vscode.Uri.file(configPath);
                const content = await vscode.workspace.fs.readFile(uri);
                const text = Buffer.from(content).toString('utf-8');
                const config = this.validateProjectConfig(this.safeJsonParse(text));
                if (config) {
                    this.projectConfigs.set(folder, config);
                }
                this.logger.info(`Loaded project config from ${configPath}`);
            } catch {
                // 文件不存在或读取失败，跳过
            }
        }
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

    getScanConfig(): ScanConfig {
        const vsCodeConfig = vscode.workspace.getConfiguration('restfulToolkit');
        const vsCodeScanPaths = this.getExplicitVsCodeSetting<string[]>(vsCodeConfig, CONFIG_KEYS.scanPaths);
        const vsCodeExcludePaths = this.getExplicitVsCodeSetting<string[]>(vsCodeConfig, CONFIG_KEYS.excludePaths);
        const vsCodeMaxResults = this.getExplicitVsCodeSetting<number>(vsCodeConfig, CONFIG_KEYS.maxResults);
        const vsCodeBaseUrl = this.getExplicitVsCodeSetting<string>(vsCodeConfig, 'baseUrl');

        const config: ScanConfig = {
            scanPaths: vsCodeScanPaths ?? this.mergeProjectArrays('scanPaths') ?? DEFAULT_CONFIG.scanPaths,
            excludePaths: vsCodeExcludePaths ?? this.mergeProjectArrays('excludePaths') ?? DEFAULT_CONFIG.excludePaths,
            maxResults: this.clampMaxResults(vsCodeMaxResults ?? this.firstProjectValue('maxResults') ?? DEFAULT_CONFIG.maxResults),
            baseUrl: vsCodeBaseUrl ?? this.firstProjectValue('baseUrl')
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

    getBaseUrl(): string {
        const scanConfig = this.getScanConfig();
        if (scanConfig.baseUrl) { return scanConfig.baseUrl; }

        const workspaceFolder = this.workspaceFolders[0];
        if (workspaceFolder) {
            const resolver = new BaseUrlResolver();
            const autoDetected = resolver.resolve(workspaceFolder);
            if (autoDetected) {
                const url = `http://${autoDetected.host}:${autoDetected.port}${autoDetected.contextPath}`;
                this.logger.info(`Auto-detected base URL: ${url}`);
                return url;
            }
        }

        return 'http://localhost:8080';
    }

    async getBaseUrlAsync(resourceUri?: vscode.Uri): Promise<string> {
        const scanConfig = this.getScanConfig();
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

    createProjectConfigTemplate(workspaceFolder: string): void {
        const configPath = path.join(workspaceFolder, PROJECT_CONFIG_FILE);

        if (fs.existsSync(configPath)) {
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
            fs.writeFileSync(configPath, JSON.stringify(template, null, 2), 'utf-8');
            this.logger.info(`Created ${PROJECT_CONFIG_FILE} template`);
            vscode.window.showInformationMessage(
                `Created ${PROJECT_CONFIG_FILE} in project root. You can customize scan settings.`
            );
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to create config template: ${err.message}`);
        }
    }

    static reset(): void {
        ConfigManager.instance = undefined as unknown as ConfigManager;
    }
}
