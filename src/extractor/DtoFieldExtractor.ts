import * as vscode from 'vscode';
import * as fs from 'fs';
import { DtoField } from '../models/types';

export class DtoFieldExtractor {
    /**
     * 根据 DTO 类型名在工作区中搜索类文件并提取字段。
     * @param dtoTypeName 类型名，如 "UserDto"
     * @returns 字段列表，找不到文件时返回空数组
     */
    async findDtoFields(dtoTypeName: string): Promise<DtoField[]> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return [];
        }

        const files = await vscode.workspace.findFiles(
            `**/${dtoTypeName}.{java,kt}`,
            '**/node_modules/**,**/target/**,**/build/**,**/.git/**'
        );

        if (files.length === 0) {
            return [];
        }

        try {
            const content = fs.readFileSync(files[0].fsPath, 'utf-8');
            return this.parseDtoFields(content);
        } catch {
            return [];
        }
    }

    /**
     * 从类文件内容中解析所有字段。
     */
    parseDtoFields(content: string): DtoField[] {
        const fields: DtoField[] = [];
        const lines = content.split('\n');

        let inClass = false;
        let braceDepth = 0;
        let pendingJsonName: string | null = null;
        let classNamingStrategy: ((n: string) => string) | null = null;

        for (const line of lines) {
            const trimmed = line.trim();

            // 跳过空行和注释
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                continue;
            }

            // 检测 @JsonNaming(...)，提取类级别命名策略
            if (!inClass) {
                const jsonNamingMatch = trimmed.match(/@JsonNaming\s*\(\s*(\w+)\s*\)/);
                if (jsonNamingMatch) {
                    classNamingStrategy = this.resolveNamingStrategy(jsonNamingMatch[1]);
                }
            }

            // 检测类声明
            if (!inClass && /\b(class|data class|object)\s+\w+/.test(trimmed)) {
                inClass = true;
                braceDepth = 0;
            }

            if (!inClass) { continue; }

            // 跟踪大括号深度，遇到类级别的闭合括号就停止
            for (const char of trimmed) {
                if (char === '{') { braceDepth++; }
                else if (char === '}') { braceDepth--; }
            }
            if (braceDepth <= 0 && trimmed.includes('}')) {
                // 类结束
                inClass = false;
                continue;
            }

            // 检测 @JsonProperty("name") 或 @JSONField(name = "name")
            const jsonPropMatch = trimmed.match(/@JsonProperty\s*\(\s*["']([^"']+)["']\s*\)/);
            const jsonFieldMatch = trimmed.match(/@JSONField\s*\(\s*name\s*=\s*["']([^"']+)["']\s*\)/);
            if (jsonPropMatch) {
                pendingJsonName = jsonPropMatch[1];
                continue;
            }
            if (jsonFieldMatch) {
                pendingJsonName = jsonFieldMatch[1];
                continue;
            }

            // 检测 @JsonAlias("name") 或 @JsonAlias({"name1", "name2"})
            const jsonAliasMatch = trimmed.match(/@JsonAlias\s*\(\s*["']([^"']+)["']\s*\)/)
                || trimmed.match(/@JsonAlias\s*\(\s*\{\s*["']([^"']+)["']/);
            if (jsonAliasMatch && !pendingJsonName) {
                pendingJsonName = jsonAliasMatch[1];
                continue;
            }

            // 检测字段声明：private/protected/public Type fieldName;
            // 或 Kotlin: val/var fieldName: Type
            const javaFieldMatch = trimmed.match(/(?:private|protected|public)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*[;=]/);
            const kotlinFieldMatch = trimmed.match(/(?:val|var)\s+(\w+)\s*:\s*(\w+(?:<[^>]+>)?)/);

            if (javaFieldMatch) {
                const type = javaFieldMatch[1];
                const name = javaFieldMatch[2];
                fields.push({
                    name: pendingJsonName || (classNamingStrategy ? classNamingStrategy(name) : name),
                    type,
                    originalName: name
                });
                pendingJsonName = null;
            } else if (kotlinFieldMatch) {
                const name = kotlinFieldMatch[1];
                const type = kotlinFieldMatch[2];
                fields.push({
                    name: pendingJsonName || (classNamingStrategy ? classNamingStrategy(name) : name),
                    type,
                    originalName: name
                });
                pendingJsonName = null;
            } else {
                // 非字段行，清除 pending
                if (!trimmed.startsWith('@') && !trimmed.startsWith('import ') && !trimmed.startsWith('package ')) {
                    pendingJsonName = null;
                }
            }
        }

        return fields;
    }

    /**
     * 将 @JsonNaming 注解值转换为命名转换函数。
     */
    private resolveNamingStrategy(value: string): ((n: string) => string) | null {
        const snakePatterns = ['PropertyNamingStrategy.SnakeCaseStrategy', 'PropertyNamingStrategies.SnakeCaseStrategy', 'SNAKE_CASE'];
        const kebabPatterns = ['PropertyNamingStrategy.KebabCaseStrategy', 'PropertyNamingStrategies.KebabCaseStrategy', 'KEBAB_CASE'];
        if (snakePatterns.some(s => value.includes(s))) {
            return (n: string) => n.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        }
        if (kebabPatterns.some(s => value.includes(s))) {
            return (n: string) => n.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
        }
        return null;
    }
}
