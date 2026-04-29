/**
 * Copy URL / cURL / Base URL 功能自动化测试脚本
 *
 * 用途：
 * - 验证 UrlGenerator 完整 URL 生成
 * - 验证 CurlConverter cURL 命令生成
 * - 验证 BaseUrlResolver 自动检测
 * - 验证无参数端点提取（Bug fix：health 端点）
 * - 验证命名转换（toSnakeCase / toCamelCase）
 *
 * 前置：npm run compile（或 npm run build）
 * 运行：node src/test/scripts/test-copy-url-curl.js
 */

const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '../../..');
process.chdir(projectRoot);

// 加载编译后的模块
const { UrlGenerator } = require(path.join(projectRoot, 'dist/extractor/UrlGenerator'));
const { CurlConverter } = require(path.join(projectRoot, 'dist/extractor/CurlConverter'));
const { BaseUrlResolver } = require(path.join(projectRoot, 'dist/utils/BaseUrlResolver'));
const { toSnakeCase, toCamelCase } = require(path.join(projectRoot, 'dist/extractor/NameTransformer'));
const { SpringParameterParser } = require(path.join(projectRoot, 'dist/extractor/SpringParameterParser'));
const { JaxRsParameterParser } = require(path.join(projectRoot, 'dist/extractor/JaxRsParameterParser'));

let totalTests = 0;
let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, testName, message) {
    totalTests++;
    if (condition) {
        passed++;
        console.log(`  ✅ ${testName}`);
    } else {
        failed++;
        errors.push({ test: testName, message });
        console.log(`  ❌ ${testName} — ${message}`);
    }
}

function assertContains(haystack, needle, testName) {
    totalTests++;
    if (haystack.includes(needle)) {
        passed++;
        console.log(`  ✅ ${testName}`);
    } else {
        failed++;
        errors.push({ test: testName, message: `期望包含 "${needle}"，实际: "${haystack}"` });
        console.log(`  ❌ ${testName} — 期望包含 "${needle}"，实际: "${haystack}"`);
    }
}

console.log('=== Copy URL / cURL 功能自动化测试 ===\n');

// 创建实例
const urlGen = new UrlGenerator();
const curlConv = new CurlConverter();
const baseUrlResolver = new BaseUrlResolver();
const springParser = new SpringParameterParser();
const jaxRsParser = new JaxRsParameterParser();

// ===== 1. UrlGenerator 测试 =====
console.log('--- 1. URL 生成 ---');

{
    // 简单 GET，无参数
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/health',
        parameters: [],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = urlGen.generate(info, 'http://localhost:8080');
    assert(result === 'http://localhost:8080/api/test/health', '简单 GET 无参数', `期望 "http://localhost:8080/api/test/health"，实际 "${result}"`);
}

{
    // GET + 路径参数（保留占位符）
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/users/{id}',
        parameters: [{ name: 'id', type: 'Long', source: 'path', originalCaseName: 'id', isRequired: true }],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = urlGen.generate(info, 'http://localhost:8080');
    assert(result === 'http://localhost:8080/api/test/users/{id}', 'GET + 路径参数占位符', `期望保留 {id}，实际 "${result}"`);
}

{
    // GET + 查询参数
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/search',
        parameters: [
            { name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: true },
            { name: 'page', type: 'int', source: 'query', originalCaseName: 'page', isRequired: false }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = urlGen.generate(info, 'http://localhost:8080');
    assert(result === 'http://localhost:8080/api/test/search?keyword=&page=', 'GET + 多查询参数', `期望拼接查询参数，实际 "${result}"`);
}

{
    // POST + Body（不拼查询参数）
    const info = {
        httpMethod: 'POST',
        contentType: 'json',
        path: '/api/test/users',
        parameters: [{ name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = urlGen.generate(info, 'http://localhost:8080');
    assert(result === 'http://localhost:8080/api/test/users', 'POST + Body 不拼查询', `期望无查询参数，实际 "${result}"`);
}

{
    // 自定义 Base URL
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/v1/items',
        parameters: [],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = urlGen.generate(info, 'https://api.example.com:3000');
    assert(result === 'https://api.example.com:3000/api/v1/items', '自定义 Base URL', `实际 "${result}"`);
}

{
    // JAX-RS 端点
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/search',
        parameters: [
            { name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: true }
        ],
        framework: 'JAX-RS',
        dtoFields: new Map()
    };
    const result = urlGen.generate(info, 'http://localhost:9090');
    assert(result === 'http://localhost:9090/api/test/search?keyword=', 'JAX-RS + 查询参数', `实际 "${result}"`);
}

// ===== 2. CurlConverter 测试 =====
console.log('\n--- 2. cURL 命令生成 ---');

{
    // GET 无参数
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/health',
        parameters: [],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, 'curl -X GET', 'GET cURL 基本格式');
    assertContains(result, 'http://localhost:8080/api/test/health', 'GET cURL URL');
    assert(!result.includes('-H') && !result.includes('-d'), 'GET cURL 无 Header/Body', `不应包含 -H 或 -d，实际: ${result}`);
}

{
    // GET + 查询参数
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/search',
        parameters: [
            { name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: true }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, '?keyword=', 'GET + 查询参数拼入 URL', `实际: ${result}`);
}

{
    // POST + JSON Body（DTO 展开）
    const dtoFields = new Map();
    dtoFields.set('UserDto', [
        { name: 'id', type: 'Long', originalName: 'id' },
        { name: 'userName', type: 'String', originalName: 'userName' },
        { name: 'email_addr', type: 'String', originalName: 'email' },
        { name: 'phone', type: 'String', originalName: 'phone' }
    ]);
    const info = {
        httpMethod: 'POST',
        contentType: 'json',
        path: '/api/test/users',
        parameters: [{ name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }],
        framework: 'Spring',
        dtoFields
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, 'curl -X POST', 'POST cURL 基本格式');
    assertContains(result, "Content-Type: application/json", 'POST cURL Content-Type');
    assertContains(result, '-d', 'POST cURL 包含 Body');
    assertContains(result, '"userName"', 'POST cURL DTO 字段展开');
    assertContains(result, '"email_addr"', 'POST cURL @JsonProperty 字段');
}

{
    // POST + JSON Body（嵌套 DTO）
    const nestedDtoFields = new Map();
    nestedDtoFields.set('OrderDto', [
        { name: 'id', type: 'Long', originalName: 'id' },
        { name: 'buyer', type: 'UserDto', originalName: 'buyer', nested: [
            { name: 'id', type: 'Long', originalName: 'id' },
            { name: 'userName', type: 'String', originalName: 'userName' }
        ]},
        { name: 'total', type: 'Double', originalName: 'total' }
    ]);
    const info = {
        httpMethod: 'POST',
        contentType: 'json',
        path: '/api/test/order',
        parameters: [{ name: 'order', type: 'OrderDto', source: 'body', originalCaseName: 'order', isRequired: true }],
        framework: 'Spring',
        dtoFields: nestedDtoFields
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, '"buyer"', '嵌套 DTO 父字段');
    assertContains(result, '"userName"', '嵌套 DTO 子字段');
    assertContains(result, '"total"', '嵌套 DTO 同级字段');
}

{
    // @RequestHeader 参数
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/data',
        parameters: [
            { name: 'X-Api-Key', type: 'String', source: 'header', originalCaseName: 'apiKey', isRequired: true, defaultValue: '' },
            { name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: true }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, "-H 'X-Api-Key: '", 'cURL 包含 @RequestHeader', `实际: ${result}`);
    assertContains(result, '?keyword=', 'cURL 查询参数保留');
}

{
    // DELETE + 路径参数
    const info = {
        httpMethod: 'DELETE',
        contentType: 'url-params',
        path: '/api/test/users/{id}',
        parameters: [
            { name: 'id', type: 'Long', source: 'path', originalCaseName: 'id', isRequired: true }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, 'curl -X DELETE', 'DELETE cURL');
    assertContains(result, '/users/{id}', 'DELETE 路径参数占位符');
    assert(!result.includes('-d'), 'DELETE 不应包含 Body', `实际: ${result}`);
}

{
    // POST + multipart/form-data
    const info = {
        httpMethod: 'POST',
        contentType: 'form-data',
        path: '/api/test/upload',
        parameters: [
            { name: 'file', type: 'MultipartFile', source: 'form', originalCaseName: 'file', isRequired: true },
            { name: 'description', type: 'String', source: 'query', originalCaseName: 'desc', isRequired: true }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, "Content-Type: multipart/form-data", 'multipart Content-Type');
    assertContains(result, '-d', 'multipart 包含 Body');
}

{
    // POST + x-www-form-urlencoded
    const info = {
        httpMethod: 'POST',
        contentType: 'x-www-form-urlencoded',
        path: '/api/test/login',
        parameters: [
            { name: 'username', type: 'String', source: 'query', originalCaseName: 'username', isRequired: true },
            { name: 'password', type: 'String', source: 'query', originalCaseName: 'password', isRequired: true }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, "Content-Type: application/x-www-form-urlencoded", 'form-urlencoded Content-Type');
    assertContains(result, '-d', 'form-urlencoded 包含 Body');
}

{
    // cURL 格式验证（Postman 兼容）— 多行格式
    const info = {
        httpMethod: 'POST',
        contentType: 'json',
        path: '/api/test/users',
        parameters: [{ name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }],
        framework: 'Spring',
        dtoFields: new Map([['UserDto', [
            { name: 'id', type: 'Long', originalName: 'id' },
            { name: 'userName', type: 'String', originalName: 'userName' }
        ]]])
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    // 验证换行续行格式
    assert(result.includes(' \\\n'), 'cURL 多行续行格式', `应包含 \\ 续行符`);
    assert(result.startsWith("curl -X POST '"), 'cURL 以 curl -X 开头', `实际: ${result.substring(0, 50)}`);
}

// ===== 3. BaseUrlResolver 测试 =====
console.log('\n--- 3. Base URL 自动检测 ---');

// 创建临时目录（模拟 Spring Boot 项目结构）
const tmpDir = path.join(projectRoot, 'test-project', 'tmp-baseurl-test');
const tmpResources = path.join(tmpDir, 'src', 'main', 'resources');
if (!fs.existsSync(tmpResources)) { fs.mkdirSync(tmpResources, { recursive: true }); }

function writeTmpConfig(filename, content) {
    fs.writeFileSync(path.join(tmpResources, filename), content);
}
function removeTmpConfig(filename) {
    fs.rmSync(path.join(tmpResources, filename), { force: true });
}

{
    // application.properties → port
    writeTmpConfig('application.properties', 'server.port=9090\nspring.application.name=myapp\n');
    const result = baseUrlResolver.resolve(tmpDir);
    assert(result !== null, 'properties 解析 port', '应返回非 null');
    if (result) {
        assert(result.port === '9090', 'properties port 值', `期望 "9090"，实际 "${result.port}"`);
    }
}

{
    // application.properties → port + context-path
    writeTmpConfig('application.properties', 'server.port=8080\nserver.servlet.context-path=/api/v1\n');
    const result = baseUrlResolver.resolve(tmpDir);
    assert(result !== null, 'properties 解析 context-path', '应返回非 null');
    if (result) {
        assert(result.port === '8080', 'properties port 值', `期望 "8080"，实际 "${result.port}"`);
        assert(result.contextPath === '/api/v1', 'properties context-path 值', `期望 "/api/v1"，实际 "${result.contextPath}"`);
    }
}

{
    // application.yml → port
    writeTmpConfig('application.yml', 'server:\n  port: 9090\n');
    const result = baseUrlResolver.resolve(tmpDir);
    assert(result !== null, 'yml 解析 port', '应返回非 null');
    if (result) {
        assert(result.port === '9090', 'yml port 值', `期望 "9090"，实际 "${result.port}"`);
    }
}

{
    // application.yml → port + context-path
    writeTmpConfig('application.yml', 'server:\n  port: 3000\n  servlet:\n    context-path: /api\n');
    const result = baseUrlResolver.resolve(tmpDir);
    assert(result !== null, 'yml 解析 port + context-path', '应返回非 null');
    if (result) {
        assert(result.port === '3000', 'yml port 值', `期望 "3000"，实际 "${result.port}"`);
        assert(result.contextPath === '/api', 'yml context-path 值', `期望 "/api"，实际 "${result.contextPath}"`);
    }
}

{
    // 占位符值 → 应跳过（先清理 yml 文件，避免干扰）
    removeTmpConfig('application.yml');
    writeTmpConfig('application.properties', 'server.port=${SERVER_PORT:8080}\n');
    const result = baseUrlResolver.resolve(tmpDir);
    // 占位符有默认值 8080，应解析出来
    assert(result !== null, '占位符默认值应解析', `期望非 null，实际: ${JSON.stringify(result)}`);
    if (result) {
        assert(result.port === '8080', '占位符默认值 port', `期望 "8080"，实际 "${result.port}"`);
    }
}

{
    // 无配置文件 → 返回 null
    removeTmpConfig('application.properties');
    removeTmpConfig('application.yml');
    const result = baseUrlResolver.resolve(tmpDir);
    assert(result === null, '无配置文件返回 null', `期望 null，实际: ${JSON.stringify(result)}`);
}

// 清理临时目录
fs.rmSync(tmpDir, { recursive: true, force: true });

// ===== 4. 命名转换测试 =====
console.log('\n--- 4. 命名转换 ---');

{
    // toSnakeCase
    assert(toSnakeCase('userName') === 'user_name', 'userName → user_name');
    assert(toSnakeCase('emailAddress') === 'email_address', 'emailAddress → email_address');
    assert(toSnakeCase('id') === 'id', 'id → id（单字不变）');
    assert(toSnakeCase('userID') === 'user_i_d', 'userID → user_i_d');
}

{
    // toCamelCase
    assert(toCamelCase('user_name') === 'userName', 'user_name → userName');
    assert(toCamelCase('email_address') === 'emailAddress', 'email_address → emailAddress');
    assert(toCamelCase('id') === 'id', 'id → id（单字不变）');
    assert(toCamelCase('user__name') === 'userName', 'user__name → userName（多余下划线）');
}

// ===== 5. 无参数端点提取验证（Bug fix） =====
console.log('\n--- 5. 无参数端点提取验证 ---');

{
    // 模拟 health 端点的注解和签名
    const springParser = new SpringParameterParser();

    // 模拟 health 方法：@GetMapping("/health") + public String health()
    const annotations = '@GetMapping("/health")';
    const signature = 'public String health()';

    const params = springParser.parseMethodParameters(signature);
    assert(params.length === 0, 'health 方法无参数', `期望 0 个参数，实际 ${params.length}`);

    // 验证 detectHttpAndContentType 逻辑
    let httpMethod = 'GET';
    if (/@PostMapping|method\s*=\s*RequestMethod\.POST/.test(annotations)) { httpMethod = 'POST'; }
    else if (/@PutMapping|method\s*=\s*RequestMethod\.PUT/.test(annotations)) { httpMethod = 'PUT'; }
    else if (/@DeleteMapping|method\s*=\s*RequestMethod\.DELETE/.test(annotations)) { httpMethod = 'DELETE'; }
    else if (/@PatchMapping|method\s*=\s*RequestMethod\.PATCH/.test(annotations)) { httpMethod = 'PATCH'; }

    assert(httpMethod === 'GET', 'health 方法 HTTP 方法检测', `期望 GET，实际 ${httpMethod}`);

    // 验证路径提取
    const pathMatch = annotations.match(/@GetMapping\s*\(\s*"([^"]+)"/);
    assert(pathMatch && pathMatch[1] === '/health', 'health 方法路径提取', `期望 "/health"，实际 ${pathMatch ? pathMatch[1] : 'null'}`);
}

{
    // 模拟 JAX-RS health 端点：@GET + @Path("/health")
    const jaxRsParser = new JaxRsParameterParser();
    const annotations = '@GET\n@Path("/health")';
    const signature = 'public String health()';

    const params = jaxRsParser.parseMethodParameters(signature);
    assert(params.length === 0, 'JAX-RS health 方法无参数', `期望 0 个参数，实际 ${params.length}`);

    let httpMethod = 'GET';
    if (/@POST\b/.test(annotations)) { httpMethod = 'POST'; }
    else if (/@PUT\b/.test(annotations)) { httpMethod = 'PUT'; }
    else if (/@DELETE\b/.test(annotations)) { httpMethod = 'DELETE'; }

    assert(httpMethod === 'GET', 'JAX-RS health HTTP 方法检测', `期望 GET，实际 ${httpMethod}`);
}

{
    // 验证类级路径拼接逻辑
    const classPath = '/api/test';
    const methodPath = '/health';

    // 模拟 concatenatePaths
    const base = classPath.endsWith('/') ? classPath.slice(0, -1) : classPath;
    const suffix = methodPath.startsWith('/') ? methodPath.slice(1) : methodPath;
    const fullPath = `${base}/${suffix}`;

    assert(fullPath === '/api/test/health', '类级路径 + 方法级路径拼接', `期望 "/api/test/health"，实际 "${fullPath}"`);
}

{
    // 验证尾随斜杠端点
    const classPath = '/api/test';
    const methodPath = '/trailing/';
    const base = classPath.endsWith('/') ? classPath.slice(0, -1) : classPath;
    const suffix = methodPath.startsWith('/') ? methodPath.slice(1) : methodPath;
    const fullPath = `${base}/${suffix}`;
    assert(fullPath === '/api/test/trailing/', '尾随斜杠保留', `期望 "/api/test/trailing/"，实际 "${fullPath}"`);
}

// ===== 6. 完整 URL 生成集成测试（模拟真实场景） =====
console.log('\n--- 6. 集成场景测试 ---');

{
    // 场景：PUT /api/test/users/{userId} + @RequestBody → cURL
    const dtoFields = new Map();
    dtoFields.set('UserDto', [
        { name: 'id', type: 'Long', originalName: 'id' },
        { name: 'userName', type: 'String', originalName: 'userName' },
        { name: 'email_addr', type: 'String', originalName: 'email' },
        { name: 'phone', type: 'String', originalName: 'phone' }
    ]);
    const info = {
        httpMethod: 'PUT',
        contentType: 'json',
        path: '/api/test/users/{userId}',
        parameters: [
            { name: 'userId', type: 'Long', source: 'path', originalCaseName: 'userId', isRequired: true },
            { name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
        ],
        framework: 'Spring',
        dtoFields
    };

    const url = urlGen.generate(info, 'http://localhost:8080');
    assert(url === 'http://localhost:8080/api/test/users/{userId}', 'PUT URL 生成', `实际 "${url}"`);

    const curl = curlConv.generate(info, 'http://localhost:8080');
    assertContains(curl, 'curl -X PUT', 'PUT cURL 方法');
    assertContains(curl, '/users/{userId}', 'PUT cURL 路径参数');
    assertContains(curl, 'Content-Type: application/json', 'PUT cURL Content-Type');
    assertContains(curl, '"userName"', 'PUT cURL Body DTO');
}

{
    // 场景：GET /api/test/users/{id} → URL
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/users/{id}',
        parameters: [
            { name: 'id', type: 'Long', source: 'path', originalCaseName: 'id', isRequired: true }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const url = urlGen.generate(info, 'http://localhost:8080');
    assert(url === 'http://localhost:8080/api/test/users/{id}', 'GET with path param URL', `实际 "${url}"`);
}

// ===== 7. Header 参数测试 =====
console.log('\n--- 7. Header 参数 ---');

{
    // Header 大小写保留：注解中定义什么大小写，cURL 中就输出什么
    const springParser = new SpringParameterParser();
    const sig = 'public String data(@RequestHeader("X-Api-Key") String apiKey, @RequestHeader("Accept-Language") String lang)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 2, '@RequestHeader 多参数数量', `期望 2 个参数，实际 ${params.length}`);
    assert(params[0].name === 'X-Api-Key', 'Header 名称大小写保留 (X-Api-Key)', `期望 "X-Api-Key"，实际 "${params[0].name}"`);
    assert(params[1].name === 'Accept-Language', 'Header 名称大小写保留 (Accept-Language)', `期望 "Accept-Language"，实际 "${params[1].name}"`);
    assert(params[0].source === 'header', 'Header source 类型', `期望 "header"，实际 "${params[0].source}"`);
    assert(params[1].source === 'header', 'Header source 类型 (第二个)', `期望 "header"，实际 "${params[1].source}"`);
}

{
    // Header 有 defaultValue
    const springParser = new SpringParameterParser();
    const sig = 'public String data(@RequestHeader(value = "X-Request-Id", defaultValue = "unknown") String requestId)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@RequestHeader with defaultValue', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'X-Request-Id', 'Header 名称提取', `期望 "X-Request-Id"，实际 "${params[0].name}"`);
    assert(params[0].defaultValue === 'unknown', 'Header defaultValue', `期望 "unknown"，实际 "${params[0].defaultValue}"`);
}

{
    // Header 无 defaultValue → defaultValue 为空字符串
    const springParser = new SpringParameterParser();
    const sig = 'public String data(@RequestHeader("Authorization") String token)';
    const params = springParser.parseMethodParameters(sig);
    assert(params[0].defaultValue === undefined, 'Header 无 defaultValue 为 undefined', `期望 undefined，实际 "${params[0].defaultValue}"`);
}

{
    // cURL 输出：Header 有空值 → 输出 `-H 'X-Api-Key: '`
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/data',
        parameters: [
            { name: 'X-Api-Key', type: 'String', source: 'header', originalCaseName: 'apiKey', isRequired: true, defaultValue: '' }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, "-H 'X-Api-Key: '", 'Header 空值输出', `实际: ${result}`);
}

{
    // cURL 输出：Header 有默认值 → 输出 `-H 'X-Request-Id: unknown'`
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/data',
        parameters: [
            { name: 'X-Request-Id', type: 'String', source: 'header', originalCaseName: 'requestId', isRequired: false, defaultValue: 'unknown' }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, "-H 'X-Request-Id: unknown'", 'Header 有默认值', `实际: ${result}`);
}

{
    // cURL 输出：多个 Header 全部输出
    const info = {
        httpMethod: 'POST',
        contentType: 'json',
        path: '/api/test/data',
        parameters: [
            { name: 'X-Api-Key', type: 'String', source: 'header', originalCaseName: 'apiKey', isRequired: true, defaultValue: '' },
            { name: 'Authorization', type: 'String', source: 'header', originalCaseName: 'auth', isRequired: true, defaultValue: 'Bearer ' },
            { name: 'body', type: 'String', source: 'body', originalCaseName: 'body', isRequired: true }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const result = curlConv.generate(info, 'http://localhost:8080');
    assertContains(result, "-H 'X-Api-Key: '", '多 Header 之一');
    assertContains(result, "-H 'Authorization: Bearer '", '多 Header 之二');
    assertContains(result, 'Content-Type: application/json', '多 Header + Content-Type');
}

{
    // JAX-RS @HeaderParam
    const jaxRsParser = new JaxRsParameterParser();
    const sig = 'public String data(@HeaderParam("X-Custom-Header") String custom)';
    const params = jaxRsParser.parseMethodParameters(sig);
    assert(params.length === 1, '@HeaderParam 参数数量', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'X-Custom-Header', '@HeaderParam 名称大小写', `期望 "X-Custom-Header"，实际 "${params[0].name}"`);
    assert(params[0].source === 'header', '@HeaderParam source 类型', `期望 "header"，实际 "${params[0].source}"`);
}

// ===== 8. BaseUrlResolver 集成测试（VS Code 设置回退链） =====
console.log('\n--- 8. BaseUrlResolver 配置回退链 ---');

{
    // 模拟 ConfigManager.getBaseUrl() 回退链
    // 场景：VS Code 设置了 baseUrl → 优先使用
    function simulateGetBaseUrl(vsCodeSetting, projectConfig, autoDetected) {
        if (vsCodeSetting) { return vsCodeSetting; }
        if (projectConfig) { return projectConfig; }
        if (autoDetected) { return `http://${autoDetected.host}:${autoDetected.port}${autoDetected.contextPath}`; }
        return 'http://localhost:8080';
    }

    // VS Code 设置优先
    const result1 = simulateGetBaseUrl('http://dev.example.com:3000', null, { host: 'localhost', port: '9090', contextPath: '/api' });
    assert(result1 === 'http://dev.example.com:3000', 'VS Code 设置优先', `期望 "http://dev.example.com:3000"，实际 "${result1}"`);

    // 项目配置回退
    const result2 = simulateGetBaseUrl('', '.restful-toolkit.json baseUrl', { host: 'localhost', port: '9090', contextPath: '/api' });
    assert(result2 === '.restful-toolkit.json baseUrl', '项目配置回退', `期望 ".restful-toolkit.json baseUrl"，实际 "${result2}"`);

    // 自动检测回退
    const result3 = simulateGetBaseUrl('', '', { host: 'localhost', port: '9090', contextPath: '/api/v2' });
    assert(result3 === 'http://localhost:9090/api/v2', '自动检测回退', `期望 "http://localhost:9090/api/v2"，实际 "${result3}"`);

    // 默认值回退
    const result4 = simulateGetBaseUrl('', '', null);
    assert(result4 === 'http://localhost:8080', '默认值回退', `期望 "http://localhost:8080"，实际 "${result4}"`);
}

// ===== 9. Header 端到端测试（从真实文件读取方法签名 + 解析器提取参数） =====
console.log('\n--- 9. Header 端到端 ---');

const testControllerPath = './test-project/src/main/java/com/example/controller/TestController.java';
const testResourcePath = './test-project/src/main/java/com/example/controller/TestResource.java';

/**
 * 从文件内容中提取完整方法签名（括号深度感知）
 */
function extractMethodSignature(content, methodName) {
    const idx = content.indexOf(methodName + '(');
    if (idx < 0) return null;
    let depth = 0;
    for (let i = idx; i < content.length; i++) {
        if (content[i] === '(') depth++;
        if (content[i] === ')') {
            depth--;
            if (depth === 0) return content.substring(idx, i + 1);
        }
    }
    return null;
}

{
    // Spring: @RequestHeader 端到端
    const controllerContent = fs.readFileSync(testControllerPath, 'utf-8');

    // 验证 /api/test/header 端点存在（正则匹配注解 + 方法签名）
    const hasHeaderEndpoint = /@GetMapping\s*\(\s*["']\/header["']\s*\)/.test(controllerContent);
    assert(hasHeaderEndpoint, 'Spring @RequestHeader 端点存在', '未找到 @GetMapping("/header")');

    // 直接解析 withHeader 方法签名验证参数提取
    const withHeaderSig = extractMethodSignature(controllerContent, 'withHeader');
    assert(withHeaderSig !== null, 'withHeader 方法签名存在', '未找到方法签名');
    if (withHeaderSig) {
        const params = springParser.parseMethodParameters(withHeaderSig);
        assert(params.length === 3, 'withHeader 参数数量', `期望 3 个参数，实际 ${params.length}`);

        const headerParams = params.filter(p => p.source === 'header');
        assert(headerParams.length === 2, 'header 参数数量', `期望 2 个 header 参数，实际 ${headerParams.length}`);

        // Header 大小写验证
        assert(headerParams[0].name === 'X-Api-Key', 'header 名称大小写 (X-Api-Key)', `期望 "X-Api-Key"，实际 "${headerParams[0].name}"`);
        assert(headerParams[1].name === 'X-Request-Id', 'header 名称大小写 (X-Request-Id)', `期望 "X-Request-Id"，实际 "${headerParams[1].name}"`);

        // Header defaultValue 验证
        assert(headerParams[1].defaultValue === 'unknown', 'header defaultValue', `期望 "unknown"，实际 "${headerParams[1].defaultValue}"`);

        // 查询参数验证
        const queryParams = params.filter(p => p.source === 'query');
        assert(queryParams.length === 1, 'query 参数数量', `期望 1 个 query 参数，实际 ${queryParams.length}`);
        assert(queryParams[0].name === 'keyword', 'query 参数名称', `期望 "keyword"，实际 "${queryParams[0].name}"`);
    }

    // 用模拟 EndpointCopyInfo 验证 cURL 端到端输出
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/header',
        parameters: [
            { name: 'X-Api-Key', type: 'String', source: 'header', originalCaseName: 'apiKey', isRequired: true, defaultValue: undefined },
            { name: 'X-Request-Id', type: 'String', source: 'header', originalCaseName: 'requestId', isRequired: false, defaultValue: 'unknown' },
            { name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: true, defaultValue: undefined }
        ],
        framework: 'Spring',
        dtoFields: new Map()
    };
    const curlResult = curlConv.generate(info, 'http://localhost:8080');
    assertContains(curlResult, 'curl -X GET', 'header cURL 基本格式');
    assertContains(curlResult, '/api/test/header?keyword=', 'header cURL URL + 查询参数');
    assertContains(curlResult, "-H 'X-Api-Key: '", 'header cURL 包含 X-Api-Key（空值）');
    assertContains(curlResult, "-H 'X-Request-Id: unknown'", 'header cURL 包含 X-Request-Id（默认值）');
}

{
    // JAX-RS: @HeaderParam 端到端
    const resourceContent = fs.readFileSync(testResourcePath, 'utf-8');

    // 验证 /api/test/auth 端点存在
    const hasAuthEndpoint = /@Path\s*\(\s*["']\/auth["']\s*\)/.test(resourceContent);
    assert(hasAuthEndpoint, 'JAX-RS @HeaderParam 端点存在', '未找到 @Path("/auth")');

    // 直接解析 auth 方法签名验证参数提取
    const authSig = extractMethodSignature(resourceContent, 'auth');
    assert(authSig !== null, 'auth 方法签名存在', '未找到方法签名');
    if (authSig) {
        const params = jaxRsParser.parseMethodParameters(authSig);
        assert(params.length === 2, 'auth 参数数量', `期望 2 个参数，实际 ${params.length}`);

        const headerParams = params.filter(p => p.source === 'header');
        assert(headerParams.length === 2, 'JAX-RS header 参数数量', `期望 2 个 header 参数，实际 ${headerParams.length}`);
        assert(headerParams[0].name === 'Authorization', 'JAX-RS header 名称大小写 (Authorization)', `期望 "Authorization"，实际 "${headerParams[0].name}"`);
        assert(headerParams[1].name === 'X-Correlation-Id', 'JAX-RS header 名称大小写 (X-Correlation-Id)', `期望 "X-Correlation-Id"，实际 "${headerParams[1].name}"`);
    }

    // cURL 端到端输出验证
    const info = {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test/auth',
        parameters: [
            { name: 'Authorization', type: 'String', source: 'header', originalCaseName: 'token', isRequired: true, defaultValue: undefined },
            { name: 'X-Correlation-Id', type: 'String', source: 'header', originalCaseName: 'correlationId', isRequired: true, defaultValue: undefined }
        ],
        framework: 'JAX-RS',
        dtoFields: new Map()
    };
    const curlResult = curlConv.generate(info, 'http://localhost:9090');
    assertContains(curlResult, 'curl -X GET', 'JAX-RS header cURL 基本格式');
    assertContains(curlResult, "/api/test/auth", 'JAX-RS header cURL URL');
    assertContains(curlResult, "-H 'Authorization: '", 'JAX-RS header cURL 包含 Authorization');
    assertContains(curlResult, "-H 'X-Correlation-Id: '", 'JAX-RS header cURL 包含 X-Correlation-Id');
    assert(!curlResult.includes('?'), 'JAX-RS header cURL 无查询参数', `不应包含 ?，实际: ${curlResult}`);
}

// ===== 汇总 =====
console.log('\n=== 测试结果汇总 ===');
console.log(`📊 总测试数: ${totalTests}`);
console.log(`✅ 通过: ${passed} (${Math.round(passed / totalTests * 100)}%)`);
console.log(`❌ 失败: ${failed} (${Math.round(failed / totalTests * 100)}%)`);

if (errors.length > 0) {
    console.log('\n=== 失败详情 ===');
    errors.forEach((e, i) => {
        console.log(`  ${i + 1}. ${e.test}: ${e.message}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ 所有测试通过！');
}
