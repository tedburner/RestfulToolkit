import * as vscode from 'vscode';

/* eslint-disable @typescript-eslint/naming-convention */
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARNING = 'WARNING',
    ERROR = 'ERROR'
}
/* eslint-enable @typescript-eslint/naming-convention */

export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('RestfulToolkit');
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    info(message: string): void {
        this.log(LogLevel.INFO, message);
    }

    debug(message: string): void {
        this.log(LogLevel.DEBUG, message);
    }

    warning(message: string): void {
        this.log(LogLevel.WARNING, message);
    }

    error(message: string, error?: Error): void {
        this.log(LogLevel.ERROR, message);
        if (error) {
            this.log(LogLevel.ERROR, error.stack || error.message);
        }
    }

    private log(level: LogLevel, message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        this.outputChannel.appendLine(logMessage);

        if (level === LogLevel.ERROR) {
            console.error(logMessage);
        } else if (level === LogLevel.WARNING) {
            console.warn(logMessage);
        } else {
            console.log(logMessage);
        }
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}