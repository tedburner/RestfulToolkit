import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DEFAULT_CONFIG, CONFIG_KEYS, PROJECT_CONFIG_FILE, ScanConfig } from './ScanConfig';
import { Logger } from '../utils/Logger';

/**
 * 配置管理器
 *
 * 统一管理所有配置来源：
 * - VS Code settings（workspace/user）
 * - 项目配置文件
 * - 默认配置
 */
export class ConfigManager {
    private static instance: ConfigManager;
    private logger: Logger;
    private projectConfig: ScanConfig | null = null;
    private workspaceFolder: string | null = null;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * 设置工作区文件夹
     */
    setWorkspaceFolder(folder: string): void {
        this.workspaceFolder = folder;
        this.loadProjectConfig();
    }

    /**
     * 加载项目配置文件（如果存在）
     */
    private loadProjectConfig(): void {
        if (!this.workspaceFolder) {
            return;
        }

        const configPath = path.join(this.workspaceFolder, PROJECT_CONFIG_FILE);

        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf-8');
                this.projectConfig = JSON.parse(content);
                this.logger.info(`Loaded project config from ${PROJECT_CONFIG_FILE}`);
            } catch (error) {
                const err = error as Error;
                this.logger.warning(`Failed to load project config: ${err.message}`);
                this.projectConfig = null;
            }
        } else {
            this.projectConfig = null;
        }
    }

    /**
     * 获取完整扫描配置（合并所有来源）
     *
     * 优先级：
     * 1. VS Code workspace settings
     * 2. 项目配置文件
     * 3. 默认配置
     */
    getScanConfig(): ScanConfig {
        const vsCodeConfig = vscode.workspace.getConfiguration('restfulToolkit');

        // 获取 VS Code settings（如果有用户自定义）
        const vsCodeScanPaths = vsCodeConfig.get<string[]>(CONFIG_KEYS.scanPaths);
        const vsCodeExcludePaths = vsCodeConfig.get<string[]>(CONFIG_KEYS.excludePaths);
        const vsCodeMaxResults = vsCodeConfig.get<number>(CONFIG_KEYS.maxResults);

        // 构建最终配置
        const config: ScanConfig = {
            scanPaths: vsCodeScanPaths ?? this.projectConfig?.scanPaths ?? DEFAULT_CONFIG.scanPaths,
            excludePaths: vsCodeExcludePaths ?? this.projectConfig?.excludePaths ?? DEFAULT_CONFIG.excludePaths,
            maxResults: vsCodeMaxResults ?? this.projectConfig?.maxResults ?? DEFAULT_CONFIG.maxResults
        };

        this.logger.info(`Effective scan config: scanPaths=${JSON.stringify(config.scanPaths)}`);

        return config;
    }

    /**
     * 获取默认配置（用于 package.json）
     */
    static getDefaultConfig(): ScanConfig {
        return DEFAULT_CONFIG;
    }

    /**
     * 创建项目配置文件模板
     */
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
            _comment: "RestfulToolkit project configuration. Override default scan settings here."
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
}