import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';

/**
 * 文件扫描状态记录
 */
interface FileScanRecord {
    lastScanTime: number;          // 最后扫描时间（毫秒）
    lastModifiedTime: number;      // 文件最后修改时间（毫秒）
    lastSize: number;              // 文件最后大小（字节）
    endpointCount: number;         // 端点数量
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
     * 判断文件是否需要重新扫描（异步版本，避免阻塞 Extension Host）
     *
     * @returns true 需要扫描，false 不需要
     */
    async needsScan(filePath: string): Promise<{ needsScan: boolean; mtime?: number; size?: number }> {
        const uri = vscode.Uri.file(filePath);

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const record = this.scanRecords.get(filePath);

            if (!record) {
                return { needsScan: true, mtime: stat.mtime, size: stat.size };
            }

            if (stat.mtime !== record.lastModifiedTime || stat.size !== record.lastSize) {
                return { needsScan: true, mtime: stat.mtime, size: stat.size };
            }

            return { needsScan: false, mtime: stat.mtime, size: stat.size };

        } catch {
            this.logger.info(`File not found or inaccessible: ${filePath}, removing from records`);
            this.removeRecord(filePath);
            return { needsScan: false };
        }
    }

    /**
     * 记录文件扫描结果（异步版本）
     */
    async recordScan(filePath: string, endpointCount: number, mtime: number, size: number): Promise<void> {
        const record: FileScanRecord = {
            lastScanTime: Date.now(),
            lastModifiedTime: mtime,
            lastSize: size,
            endpointCount
        };

        this.scanRecords.set(filePath, record);
    }

    /**
     * 移除文件扫描记录
     */
    removeRecord(filePath: string): void {
        if (this.scanRecords.has(filePath)) {
            this.scanRecords.delete(filePath);
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

    static reset(): void {
        if (ScanStateManager.instance) {
            ScanStateManager.instance.clearAll();
            ScanStateManager.instance = undefined as unknown as ScanStateManager;
        }
    }
}
