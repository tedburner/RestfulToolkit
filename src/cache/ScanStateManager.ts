import * as vscode from 'vscode';
import * as fs from 'fs';
import { Logger } from '../utils/Logger';

/**
 * 文件扫描状态记录
 */
interface FileScanRecord {
    filePath: string;
    lastScanTime: number;          // 最后扫描时间（毫秒）
    lastModifiedTime: number;      // 文件最后修改时间（毫秒）
    endpointCount: number;         // 端点数量
    fileHash?: string;             // 文件内容哈希（可选，用于更精确检测）
}

/**
 * 扫描状态管理器
 *
 * 使用内存缓存扫描状态，每次 VS Code 启动都会全量扫描
 * 不持久化到本地，随 VS Code 会话关闭而销毁
 */
export class ScanStateManager {
    private static instance: ScanStateManager;
    private logger: Logger;
    private scanRecords: Map<string, FileScanRecord> = new Map();

    private constructor() {
        this.logger = Logger.getInstance();
        this.logger.info('ScanStateManager initialized (memory-only mode, no persistence)');
    }

    static getInstance(): ScanStateManager {
        if (!ScanStateManager.instance) {
            ScanStateManager.instance = new ScanStateManager();
        }
        return ScanStateManager.instance;
    }

    /**
     * 设置扩展上下文（不再使用，但保留接口兼容）
     */
    setContext(context: vscode.ExtensionContext): void {
        // 不再使用 workspaceState 持久化
        this.logger.info('ScanStateManager running in memory-only mode, ignoring workspaceState');
    }

    /**
     * 从持久化存储加载扫描状态（已移除）
     */
    private loadState(): void {
        // 不再加载历史数据，每次启动都是全新的
        this.logger.info('Memory-only mode: skipping state load, will perform full scan');
    }

    /**
     * 保存扫描状态到持久化存储（已移除）
     */
    saveState(): void {
        // 不再持久化到 workspaceState
        this.logger.info(`Memory-only mode: ${this.scanRecords.size} scan records in memory (not saved to disk)`);
    }

    /**
     * 判断文件是否需要重新扫描
     *
     * @returns true 需要扫描，false 不需要
     */
    needsScan(filePath: string): boolean {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            this.logger.info(`File not found: ${filePath}, removing from records`);
            this.removeRecord(filePath);
            return false;
        }

        const record = this.scanRecords.get(filePath);

        // 没有记录，需要扫描
        if (!record) {
            this.logger.info(`No previous scan record for: ${filePath}`);
            return true;
        }

        // 获取文件当前修改时间
        try {
            const stats = fs.statSync(filePath);
            const currentModifiedTime = stats.mtimeMs;

            // 文件修改时间变化，需要重新扫描
            if (currentModifiedTime > record.lastModifiedTime) {
                this.logger.info(`File modified since last scan: ${filePath}`);
                return true;
            }

            // 文件未修改，跳过扫描
            this.logger.info(`File unchanged, skipping: ${filePath} (last scan: ${new Date(record.lastScanTime).toLocaleString()})`);
            return false;

        } catch (error) {
            const err = error as Error;
            this.logger.warning(`Failed to check file stats: ${filePath}, ${err.message}`);
            return true;  // 无法判断，保守策略：扫描
        }
    }

    /**
     * 记录文件扫描结果
     */
    recordScan(filePath: string, endpointCount: number): void {
        try {
            const stats = fs.statSync(filePath);
            const record: FileScanRecord = {
                filePath,
                lastScanTime: Date.now(),
                lastModifiedTime: stats.mtimeMs,
                endpointCount
            };

            this.scanRecords.set(filePath, record);
            this.logger.info(`Recorded scan for ${filePath}: ${endpointCount} endpoints`);

        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to record scan for ${filePath}: ${err.message}`);
        }
    }

    /**
     * 移除文件扫描记录
     */
    removeRecord(filePath: string): void {
        if (this.scanRecords.has(filePath)) {
            this.scanRecords.delete(filePath);
            this.logger.info(`Removed scan record for: ${filePath}`);
        }
    }

    /**
     * 清空所有扫描记录
     */
    clearAll(): void {
        this.scanRecords.clear();
        this.logger.info('Cleared all scan records');
    }

    /**
     * 获取扫描统计信息
     */
    getStats(): { totalFiles: number; totalEndpoints: number; lastScanTime: number | null } {
        let totalEndpoints = 0;
        let lastScanTime: number | null = null;

        for (const record of this.scanRecords.values()) {
            totalEndpoints += record.endpointCount;
            if (!lastScanTime || record.lastScanTime > lastScanTime) {
                lastScanTime = record.lastScanTime;
            }
        }

        return {
            totalFiles: this.scanRecords.size,
            totalEndpoints,
            lastScanTime
        };
    }

    /**
     * 获取所有已扫描文件路径
     */
    getAllScannedFiles(): string[] {
        return Array.from(this.scanRecords.keys());
    }

    /**
     * 检查是否有历史扫描记录
     */
    hasHistory(): boolean {
        return this.scanRecords.size > 0;
    }
}