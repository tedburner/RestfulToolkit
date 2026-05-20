import * as vscode from 'vscode';
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
     * 设置扩展上下文（已弃用：不再使用 workspaceState）
     * @deprecated 现在使用内存模式，此方法已无实际作用
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setContext(context: vscode.ExtensionContext): void {
        // 不再使用 workspaceState 持久化，参数仅保留接口兼容性
        void context; // 显式标记为未使用
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
     * 判断文件是否需要重新扫描（异步版本，避免阻塞 Extension Host）
     *
     * @returns true 需要扫描，false 不需要
     */
    async needsScan(filePath: string): Promise<{ needsScan: boolean; mtime?: number }> {
        const uri = vscode.Uri.file(filePath);

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const record = this.scanRecords.get(filePath);

            if (!record) {
                this.logger.info(`No previous scan record for: ${filePath}`);
                return { needsScan: true, mtime: stat.mtime };
            }

            if (stat.mtime > record.lastModifiedTime) {
                this.logger.info(`File modified since last scan: ${filePath}`);
                return { needsScan: true, mtime: stat.mtime };
            }

            this.logger.info(`File unchanged, skipping: ${filePath} (last scan: ${new Date(record.lastScanTime).toLocaleString()})`);
            return { needsScan: false, mtime: stat.mtime };

        } catch {
            this.logger.info(`File not found or inaccessible: ${filePath}, removing from records`);
            this.removeRecord(filePath);
            return { needsScan: false };
        }
    }

    /**
     * 记录文件扫描结果（异步版本）
     */
    async recordScan(filePath: string, endpointCount: number, mtime: number): Promise<void> {
        const record: FileScanRecord = {
            filePath,
            lastScanTime: Date.now(),
            lastModifiedTime: mtime,
            endpointCount
        };

        this.scanRecords.set(filePath, record);
        this.logger.info(`Recorded scan for ${filePath}: ${endpointCount} endpoints`);
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