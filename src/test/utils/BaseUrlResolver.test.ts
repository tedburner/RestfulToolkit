import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { BaseUrlResolver } from '../../utils/BaseUrlResolver';

suite('BaseUrlResolver Test Suite', () => {
    let resolver: BaseUrlResolver;
    let tempDir: string;

    setup(() => {
        resolver = new BaseUrlResolver();
        tempDir = fs.mkdtempSync(path.join(__dirname, 'test-baseurl-'));
    });

    teardown(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    function writeResourceFile(name: string, content: string) {
        const resourcesDir = path.join(tempDir, 'src', 'main', 'resources');
        fs.mkdirSync(resourcesDir, { recursive: true });
        fs.writeFileSync(path.join(resourcesDir, name), content);
    }

    // ===== 基础 properties 解析 =====

    test('Should parse server.port from application.properties', () => {
        writeResourceFile('application.properties', 'server.port=9090\nspring.application.name=myapp\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });

    test('Should parse context-path from application.properties', () => {
        writeResourceFile('application.properties', 'server.port=8080\nserver.servlet.context-path=/api/v1\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '8080');
        assert.strictEqual(result!.contextPath, '/api/v1');
    });

    test('Should parse server.port from application.yml', () => {
        writeResourceFile('application.yml', 'server:\n  port: 9090\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });

    test('Should parse context-path from nested YAML', () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n  servlet:\n    context-path: /api/v1\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '8080');
        assert.strictEqual(result!.contextPath, '/api/v1');
    });

    // ===== bootstrap.yml 优先级 =====

    test('bootstrap.yml port overrides application.yml', () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n');
        writeResourceFile('bootstrap.yml', 'server:\n  port: 7070\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '7070');
    });

    test('bootstrap.properties has highest priority', () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n');
        writeResourceFile('bootstrap.properties', 'server.port=6060\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '6060');
    });

    // ===== 多环境 profile 覆盖 =====

    test('application-dev.yml overrides application.yml', () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n');
        writeResourceFile('application-dev.yml', 'server:\n  port: 9090\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });

    test('application-profile.yaml is also recognized', () => {
        writeResourceFile('application.yaml', 'server:\n  port: 8080\n');
        writeResourceFile('application-local.yaml', 'server:\n  port: 3000\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '3000');
    });

    test('profile context-path overrides base context-path', () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n  servlet:\n    context-path: /api\n');
        writeResourceFile('application-prod.yml', 'server:\n  servlet:\n    context-path: /api/v2\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.contextPath, '/api/v2');
    });

    // ===== 占位符解析 =====

    test('Should parse placeholder with default value', () => {
        writeResourceFile('application.properties', 'server.port=${SERVER_PORT:9090}\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });

    test('Should skip placeholder without default value', () => {
        writeResourceFile('application.properties', 'server.port=${server.port}\n');
        const result = resolver.resolve(tempDir);
        assert.strictEqual(result, null);
    });

    test('Should parse YAML placeholder with default', () => {
        writeResourceFile('application.yml', 'server:\n  port: ${PORT:8888}\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '8888');
    });

    // ===== 旧版 server.context-path =====

    test('Should parse old server.context-path', () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n  context-path: /old-api\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.contextPath, '/old-api');
    });

    test('Should parse old server.context-path from properties', () => {
        writeResourceFile('application.properties', 'server.port=8080\nserver.context-path=/old-api\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.contextPath, '/old-api');
    });

    test('server.servlet.context-path takes precedence over server.context-path', () => {
        writeResourceFile('application.yml', 'server:\n  port: 8080\n  context-path: /old\n  servlet:\n    context-path: /new\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.contextPath, '/new');
    });

    // ===== 无配置 / 边界情况 =====

    test('Should return null when no config file exists', () => {
        const result = resolver.resolve(tempDir);
        assert.strictEqual(result, null);
    });

    test('Should use default port 8080 when only context-path is set', () => {
        writeResourceFile('application.yml', 'server:\n  servlet:\n    context-path: /api\n');
        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '8080');
        assert.strictEqual(result!.contextPath, '/api');
    });

    test('Should support multiple modules (multiple resources dirs)', () => {
        const apiDir = path.join(tempDir, 'api-module', 'src', 'main', 'resources');
        fs.mkdirSync(apiDir, { recursive: true });
        fs.writeFileSync(path.join(apiDir, 'application.yml'), 'server:\n  port: 9090\n');

        const result = resolver.resolve(tempDir);
        assert.ok(result !== null);
        assert.strictEqual(result!.port, '9090');
    });
});
