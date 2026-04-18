/**
 * 统一配置管理
 *
 * 所有默认配置都在这里定义，避免多处维护
 * 用户可以通过 VS Code settings.json 或项目配置文件自定义
 */

export interface ScanConfig {
    scanPaths: string[];
    excludePaths: string[];
    maxResults: number;
}

/**
 * 默认扫描配置
 *
 * 支持场景：
 * - 单模块 Maven/Gradle 项目
 * - 多模块 Maven 项目（如 spring-ai-project）
 * - 多层级嵌套项目
 */
export const DEFAULT_CONFIG: ScanConfig = {
    scanPaths: [
        '**/src/main/java/**/*.java',
        '**/src/main/kotlin/**/*.kt'
    ],
    excludePaths: [
        '**/src/test/**',
        '**/target/**',
        '**/build/**',
        '**/.gradle/**',
        '**/node_modules/**'
    ],
    maxResults: 100
};

/**
 * 配置键名（对应 package.json 的 contributes.configuration）
 */
export const CONFIG_KEYS = {
    scanPaths: 'scanPaths',
    excludePaths: 'excludePaths',
    maxResults: 'maxResults'
} as const;

/**
 * 项目配置文件名（可选的外部配置）
 *
 * 用户可以在项目根目录创建此文件自定义扫描配置
 */
export const PROJECT_CONFIG_FILE = '.restful-toolkit.json';

/**
 * 获取用户配置（优先级）
 *
 * 优先级顺序：
 * 1. VS Code workspace settings（最高）
 * 2. 项目配置文件 .restful-toolkit.json
 * 3. 默认配置（最低）
 */
export function getScanConfig(workspaceFolder?: string): ScanConfig {
    // 这里只是定义函数，实际逻辑在 FileScanner 或专门的 ConfigManager 中实现
    return DEFAULT_CONFIG;
}