import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';

export class FileWatcher {
    private watchers: vscode.FileSystemWatcher[] = [];
    private logger: Logger;
    private onCreateHandler: ((uri: vscode.Uri) => void) | null = null;
    private onChangeHandler: ((uri: vscode.Uri) => void) | null = null;
    private onDeleteHandler: ((uri: vscode.Uri) => void) | null = null;

    constructor() {
        this.logger = Logger.getInstance();
    }

    setOnCreate(handler: (uri: vscode.Uri) => void): void {
        this.onCreateHandler = handler;
    }

    setOnChange(handler: (uri: vscode.Uri) => void): void {
        this.onChangeHandler = handler;
    }

    setOnDelete(handler: (uri: vscode.Uri) => void): void {
        this.onDeleteHandler = handler;
    }

    start(patterns: string[]): void {
        for (const pattern of patterns) {
            this.logger.info(`Starting file watcher for pattern: ${pattern}`);

            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidCreate(uri => {
                this.logger.info(`File created: ${uri.fsPath}`);
                if (this.onCreateHandler) {
                    this.onCreateHandler(uri);
                }
            });

            watcher.onDidChange(uri => {
                this.logger.info(`File changed: ${uri.fsPath}`);
                if (this.onChangeHandler) {
                    this.onChangeHandler(uri);
                }
            });

            watcher.onDidDelete(uri => {
                this.logger.info(`File deleted: ${uri.fsPath}`);
                if (this.onDeleteHandler) {
                    this.onDeleteHandler(uri);
                }
            });

            this.watchers.push(watcher);
        }
    }

    stop(): void {
        this.logger.info('Stopping all file watchers');
        for (const watcher of this.watchers) {
            watcher.dispose();
        }
        this.watchers = [];
    }

    dispose(): void {
        this.stop();
    }
}