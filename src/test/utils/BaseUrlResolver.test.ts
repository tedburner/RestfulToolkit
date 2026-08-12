import * as assert from 'assert';
import fs = require('fs');
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { BaseUrlResolver } from '../../utils/BaseUrlResolver';

suite('BaseUrlResolver Test Suite', () => {
    let resolver: BaseUrlResolver;
    let tempDir: string;
    const originalWorkspaceReadFile = vscode.workspace.fs.readFile;
    const originalWorkspaceReadDirectory = vscode.workspace.fs.readDirectory;

    setup(() => {
        BaseUrlResolver.reset();
        resolver = new BaseUrlResolver();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restful-toolkit-baseurl-'));
    });

    teardown(() => {
        BaseUrlResolver.reset();
        vscode.workspace.fs.readFile = originalWorkspaceReadFile;
        vscode.workspace.fs.readDirectory = originalWorkspaceReadDirectory;
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    function writeResourceFile(name: string, content: string): string {
        const resourcesDir = path.join(tempDir, 'src', 'main', 'resources');
        fs.mkdirSync(resourcesDir, { recursive: true });
        const filePath = path.join(resourcesDir, name);
        fs.writeFileSync(filePath, content);
        return filePath;
    }

    // ===== 基础 properties 解析 =====

    test('Should parse server.port from application.properties', async () => {
        writeResourceFile('application.properties', 'server.port=9090\nspring.application.name=myapp\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });

    test('Should resolve Base URL asynchronously through VS Code filesystem', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 9191\n  servlet:\n    context-path: /async\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9191');
        assert.strictEqual(result!.contextPath, '/async');
    });

    test('Should reuse cached async result without reading the file again', async () => {
        writeResourceFile('application.properties', 'server.port=9090\n');
        const first = await resolver.resolveAsync(tempDir);
        assert.ok(first !== null);
        assert.strictEqual(first!.port, '9090');

        vscode.workspace.fs.readFile = async () => {
            throw new Error('Config file should not be read again when cache is valid');
        };

        const second = await new BaseUrlResolver().resolveAsync(tempDir);
        assert.deepStrictEqual(second, first);
    });

    test('Should reuse cached async discovery until explicitly invalidated', async () => {
        writeResourceFile('application.properties', 'server.port=9090\n');
        const first = await resolver.resolveAsync(tempDir);
        assert.ok(first !== null);

        vscode.workspace.fs.readDirectory = async () => {
            throw new Error('Directory discovery should not run on a cache hit');
        };
        try {
            assert.deepStrictEqual(await new BaseUrlResolver().resolveAsync(tempDir), first);
        } finally {
            vscode.workspace.fs.readDirectory = originalWorkspaceReadDirectory;
        }

        const resolverType = BaseUrlResolver as unknown as { invalidate(workspaceFolder: string): void };
        resolverType.invalidate(tempDir);
        writeResourceFile('application.properties', 'server.port=10010\n');
        const refreshed = await new BaseUrlResolver().resolveAsync(tempDir);
        assert.strictEqual(refreshed?.port, '10010');
    });

    test('Should invalidate only the selected workspace cache', async () => {
        const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restful-toolkit-baseurl-other-'));
        try {
            writeResourceFile('application.properties', 'server.port=9090\n');
            const otherResources = path.join(otherDir, 'src', 'main', 'resources');
            fs.mkdirSync(otherResources, { recursive: true });
            fs.writeFileSync(path.join(otherResources, 'application.properties'), 'server.port=7070\n');
            await resolver.resolveAsync(tempDir);
            await resolver.resolveAsync(otherDir);

            fs.writeFileSync(path.join(otherResources, 'application.properties'), 'server.port=6060\n');
            BaseUrlResolver.invalidate(tempDir);
            assert.strictEqual((await new BaseUrlResolver().resolveAsync(otherDir))?.port, '7070');

            BaseUrlResolver.invalidate(otherDir);
            assert.strictEqual((await new BaseUrlResolver().resolveAsync(otherDir))?.port, '6060');
        } finally {
            fs.rmSync(otherDir, { recursive: true, force: true });
        }
    });

    test('Should reuse cached async result when config file metadata is unchanged', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 9191\n');
        const first = await resolver.resolveAsync(tempDir);
        assert.ok(first !== null);
        assert.strictEqual(first!.port, '9191');

        vscode.workspace.fs.readFile = async () => {
            throw new Error('Config file should not be read again when cache is valid');
        };

        const second = await new BaseUrlResolver().resolveAsync(tempDir);
        assert.deepStrictEqual(second, first);
    });

    test('Should not repopulate cache from an async resolution invalidated while reading', async () => {
        writeResourceFile('application.properties', 'server.port=9090\n');
        let notifyReadStarted!: () => void;
        const readStarted = new Promise<void>(resolve => { notifyReadStarted = resolve; });
        let releaseRead!: () => void;
        const readCanFinish = new Promise<void>(resolve => { releaseRead = resolve; });
        let firstRead = true;

        vscode.workspace.fs.readFile = async (uri) => {
            if (firstRead) {
                firstRead = false;
                notifyReadStarted();
                await readCanFinish;
                return Buffer.from('server.port=9090\n');
            }
            return originalWorkspaceReadFile(uri);
        };

        const staleResolution = resolver.resolveAsync(tempDir);
        await readStarted;
        writeResourceFile('application.properties', 'server.port=10010\n');
        BaseUrlResolver.invalidate(tempDir);
        releaseRead();

        assert.strictEqual((await staleResolution)?.port, '9090');
        assert.strictEqual(
            (await new BaseUrlResolver().resolveAsync(tempDir))?.port,
            '10010',
            'an invalidated in-flight result must not become the next cache hit'
        );
    });

    test('Should invalidate cached result when config file changes', async () => {
        writeResourceFile('application.properties', 'server.port=9090\n');
        const first = await resolver.resolveAsync(tempDir);
        assert.ok(first !== null);
        assert.strictEqual(first!.port, '9090');

        writeResourceFile('application.properties', 'server.port=10010\n');
        BaseUrlResolver.invalidate(tempDir);
        const second = await new BaseUrlResolver().resolveAsync(tempDir);
        assert.ok(second !== null);
        assert.strictEqual(second!.port, '10010');
    });

    test('Should invalidate cached result when same-size config content changes', async () => {
        const configFile = writeResourceFile('application.properties', 'server.port=9090\n');
        const first = await resolver.resolveAsync(tempDir);
        assert.ok(first !== null);
        assert.strictEqual(first!.port, '9090');

        fs.writeFileSync(configFile, 'server.port=8081\n');

        BaseUrlResolver.invalidate(tempDir);
        const second = await new BaseUrlResolver().resolveAsync(tempDir);
        assert.ok(second !== null);
        assert.strictEqual(second!.port, '8081');
    });

    test('Should parse context-path from application.properties', async () => {
        writeResourceFile('application.properties', 'server.port=8080\nserver.servlet.context-path=/api/v1\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '8080');
        assert.strictEqual(result!.contextPath, '/api/v1');
    });

    test('Should parse server.port from application.yml', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 9090\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });

    test('Should parse server.port from application.yaml', async () => {
        writeResourceFile('application.yaml', 'server:\n  port: 9191\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9191');
    });

    test('Should parse context-path from nested YAML', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n  servlet:\n    context-path: /api/v1\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '8080');
        assert.strictEqual(result!.contextPath, '/api/v1');
    });

    // ===== bootstrap.yml 优先级 =====

    test('bootstrap.yml port overrides application.yml', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n');
        writeResourceFile('bootstrap.yml', 'server:\n  port: 7070\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '7070');
    });

    test('bootstrap.properties has highest priority', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n');
        writeResourceFile('bootstrap.properties', 'server.port=6060\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '6060');
    });

    // ===== 多环境 profile 覆盖 =====

    test('application-dev.yml overrides application.yml', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n');
        writeResourceFile('application-dev.yml', 'server:\n  port: 9090\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });

    test('application-profile.yaml is also recognized', async () => {
        writeResourceFile('application.yaml', 'server:\n  port: 8080\n');
        writeResourceFile('application-local.yaml', 'server:\n  port: 3000\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '3000');
    });

    test('profile context-path overrides base context-path', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n  servlet:\n    context-path: /api\n');
        writeResourceFile('application-prod.yml', 'server:\n  servlet:\n    context-path: /api/v2\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.contextPath, '/api/v2');
    });

    // ===== 占位符解析 =====

    test('Should parse placeholder with default value', async () => {
        writeResourceFile('application.properties', 'server.port=${SERVER_PORT:9090}\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });

    test('Should skip placeholder without default value', async () => {
        writeResourceFile('application.properties', 'server.port=${server.port}\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.strictEqual(result, null);
    });

    test('Should parse YAML placeholder with default', async () => {
        writeResourceFile('application.yml', 'server:\n  port: ${PORT:8888}\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '8888');
    });

    // ===== 旧版 server.context-path =====

    test('Should parse old server.context-path', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n  context-path: /old-api\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.contextPath, '/old-api');
    });

    test('Should parse old server.context-path from properties', async () => {
        writeResourceFile('application.properties', 'server.port=8080\nserver.context-path=/old-api\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.contextPath, '/old-api');
    });

    test('server.servlet.context-path takes precedence over server.context-path', async () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n  context-path: /old\n  servlet:\n    context-path: /new\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.contextPath, '/new');
    });

    // ===== 无配置 / 边界情况 =====

    test('Should return null when no config file exists', async () => {
        const result = await resolver.resolveAsync(tempDir);
        assert.strictEqual(result, null);
    });

    test('Should use default port 8080 when only context-path is set', async () => {
        writeResourceFile('application.yml', 'server:\n  servlet:\n    context-path: /api\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '8080');
        assert.strictEqual(result!.contextPath, '/api');
    });

    test('Should not read management context-path as server context-path', async () => {
        writeResourceFile('application.yml', 'management:\n  endpoint:\n    context-path: /internal\n');
        const result = await resolver.resolveAsync(tempDir);
        assert.strictEqual(result, null);
    });

    test('Should support multiple modules (multiple resources dirs)', async () => {
        const apiDir = path.join(tempDir, 'api-module', 'src', 'main', 'resources');
        fs.mkdirSync(apiDir, { recursive: true });
        fs.writeFileSync(path.join(apiDir, 'application.yml'), 'server:\n  port: 9090\n');

        const result = await resolver.resolveAsync(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });
});
