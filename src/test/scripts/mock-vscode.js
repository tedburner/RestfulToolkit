const fs = require('fs');
const path = require('path');
const Module = require('module');

const originalLoad = Module._load;

function walkFiles(root, results) {
    if (!fs.existsSync(root)) {
        return;
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', 'target', 'build', '.git'].includes(entry.name)) {
                continue;
            }
            walkFiles(fullPath, results);
        } else {
            results.push(fullPath);
        }
    }
}

function globToRegExp(pattern) {
    const normalized = pattern.replace(/\\/g, '/');
    const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regex = escaped
        .replace(/\\\{([^}]+)\\\}/g, (_, group) => `(${group.split(',').map(item => item.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('|')})`)
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
    return new RegExp(`^${regex}$`);
}

const vscodeMock = {
    FileType: {
        File: 1,
        Directory: 2,
        SymbolicLink: 64,
        Unknown: 0
    },
    Uri: {
        file: (filePath) => ({ fsPath: path.resolve(filePath) }),
        joinPath: (base, ...segments) => ({ fsPath: path.join(base.fsPath, ...segments) })
    },
    window: {
        createOutputChannel: () => ({
            appendLine: () => undefined,
            show: () => undefined,
            dispose: () => undefined
        }),
        showInformationMessage: async () => undefined,
        showWarningMessage: async () => undefined,
        showErrorMessage: async () => undefined,
        showQuickPick: async () => undefined,
        showInputBox: async () => undefined,
        showTextDocument: async () => undefined
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
        fs: {
            readFile: async (uri) => fs.promises.readFile(uri.fsPath),
            writeFile: async (uri, data) => fs.promises.writeFile(uri.fsPath, data),
            stat: async (uri) => fs.promises.stat(uri.fsPath),
            readDirectory: async (uri) => {
                const entries = await fs.promises.readdir(uri.fsPath, { withFileTypes: true });
                return entries.map(entry => [
                    entry.name,
                    entry.isDirectory() ? vscodeMock.FileType.Directory : vscodeMock.FileType.File
                ]);
            }
        },
        findFiles: async (include) => {
            const files = [];
            walkFiles(process.cwd(), files);
            const matcher = globToRegExp(include);
            return files
                .map(filePath => filePath.replace(/\\/g, '/'))
                .filter(filePath => matcher.test(filePath.replace(process.cwd().replace(/\\/g, '/') + '/', '')))
                .map(filePath => ({ fsPath: filePath }));
        },
        getConfiguration: () => ({
            get: () => undefined,
            inspect: () => undefined
        }),
        getWorkspaceFolder: (uri) => {
            const folder = vscodeMock.workspace.workspaceFolders.find(item => {
                const root = path.resolve(item.uri.fsPath);
                const filePath = path.resolve(uri.fsPath);
                return filePath === root || filePath.startsWith(root + path.sep);
            });
            return folder;
        },
        onDidChangeConfiguration: () => ({ dispose: () => undefined }),
        onDidChangeWorkspaceFolders: () => ({ dispose: () => undefined }),
        openTextDocument: async (uri) => ({ uri })
    },
    env: {
        clipboard: {
            readText: async () => '',
            writeText: async () => undefined
        }
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    }
};

Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'vscode') {
        return vscodeMock;
    }
    return originalLoad.call(this, request, parent, isMain);
};
