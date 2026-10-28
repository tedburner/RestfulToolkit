/**
 * cURL 生成语义验证：用真实 curl 进程把生成的命令发到本地 HTTP 接收端，
 * 核对服务端实际收到的方法、URL、查询参数、请求头与正文（JSON / urlencoded /
 * multipart 分段）。字符串包含断言无法覆盖协议语义（例如 L6 修复前 multipart
 * 输出的是普通 urlencoded 正文，字符串测试依然全绿），本脚本补上这一层。
 *
 * 前置：npm run compile（或 npm test 的 pretest）
 * 运行：node src/test/scripts/test-curl-semantic.js
 * 跳过：Windows（shell 单引号语义不同）或 curl 不可用时报告 SKIP 并以 0 退出。
 */

const { ensureFreshDist } = require('./lib/dist-check');
ensureFreshDist();

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const projectRoot = path.resolve(__dirname, '../../..');
const { CurlConverter } = require(path.join(projectRoot, 'dist/extractor/CurlConverter'));
const { makeCopyInfo } = require('./lib/copy-info-fixture');

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

function assertEqual(actual, expected, testName) {
    assert(
        actual === expected,
        testName,
        `期望 "${expected}"，实际 "${actual}"`
    );
}

function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: os.tmpdir() }, error => (error ? reject(error) : resolve()));
    });
}

function commandExists(command) {
    return new Promise(resolve => {
        exec(`${command} --version`, error => resolve(!error));
    });
}

function makeParameter(overrides) {
    return {
        name: 'param', type: 'String', source: 'query', originalCaseName: 'param', isRequired: false,
        ...overrides
    };
}

/** 解析 multipart/form-data 正文：返回 [{ name, filename, content }] */
function parseMultipart(contentType, body) {
    const boundaryMatch = /boundary=([^;]+)/.exec(contentType);
    if (!boundaryMatch) { return null; }
    const boundary = `--${boundaryMatch[1]}`;
    const parts = [];
    for (const segment of body.split(boundary)) {
        const headerEnd = segment.indexOf('\r\n\r\n');
        if (headerEnd === -1) { continue; }
        const disposition = segment.slice(0, headerEnd);
        const nameMatch = /name="([^"]*)"/.exec(disposition);
        if (!nameMatch) { continue; }
        const filenameMatch = /filename="([^"]*)"/.exec(disposition);
        let content = segment.slice(headerEnd + 4);
        if (content.endsWith('\r\n')) { content = content.slice(0, -2); }
        parts.push({ name: nameMatch[1], filename: filenameMatch ? filenameMatch[1] : null, content });
    }
    return parts;
}

async function main() {
    if (process.platform === 'win32') {
        console.log('⏭️  Windows 下生成的单引号 shell 语义不同，跳过 cURL 语义验证');
        return;
    }
    if (!(await commandExists('curl'))) {
        console.log('⏭️  未找到 curl 可执行文件，跳过 cURL 语义验证');
        return;
    }

    const requests = [];
    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            requests.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: Buffer.concat(chunks).toString('utf8')
            });
            res.statusCode = 200;
            res.end('ok');
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const tmpFile = path.join(os.tmpdir(), `restful-toolkit-curl-semantic-${process.pid}.txt`);
    fs.writeFileSync(tmpFile, 'file-payload-42', 'utf8');

    const converter = new CurlConverter();

    try {
        console.log('\n=== cURL 语义验证（POST JSON + 查询参数） ===');
        {
            requests.length = 0;
            const command = converter.generate(makeCopyInfo({
                httpMethod: 'POST',
                contentType: 'json',
                path: '/users',
                parameters: [
                    makeParameter({ name: 'source', source: 'query' }),
                    makeParameter({ name: 'userDto', type: 'UserDto', source: 'body' })
                ]
            }), baseUrl);
            await runCommand(command);
            const received = requests[0];
            assert(received, '服务端收到请求');
            assertEqual(received.method, 'POST', 'HTTP 方法为 POST');
            assert(
                new URL(`${baseUrl}${received.url}`).searchParams.has('source'),
                'POST 的查询参数保留在 URL 上',
                `实际 URL: ${received.url}`
            );
            assertEqual(received.headers['content-type'], 'application/json', 'Content-Type 为 application/json');
            const parsed = JSON.parse(received.body);
            assertEqual(parsed.userDto, '', 'JSON 正文包含 body 参数占位');
        }

        console.log('\n=== cURL 语义验证（GET 多查询参数） ===');
        {
            requests.length = 0;
            const command = converter.generate(makeCopyInfo({
                httpMethod: 'GET',
                contentType: 'url-params',
                path: '/search',
                parameters: [
                    makeParameter({ name: 'keyword', source: 'query' }),
                    makeParameter({ name: 'page', type: 'int', source: 'query' })
                ]
            }), baseUrl);
            await runCommand(command);
            const received = requests[0];
            const params = new URL(`${baseUrl}${received.url}`).searchParams;
            assert(params.has('keyword') && params.has('page'), 'GET 查询参数全部到达服务端', `实际 URL: ${received.url}`);
            assert(!received.headers['content-type'], 'GET 不携带正文 Content-Type');
        }

        console.log('\n=== cURL 语义验证（urlencoded 正文） ===');
        {
            requests.length = 0;
            const command = converter.generate(makeCopyInfo({
                httpMethod: 'POST',
                contentType: 'x-www-form-urlencoded',
                path: '/login',
                parameters: [
                    makeParameter({ name: 'username', source: 'form' }),
                    makeParameter({ name: 'password', source: 'form' })
                ]
            }), baseUrl);
            await runCommand(command);
            const received = requests[0];
            assertEqual(received.headers['content-type'], 'application/x-www-form-urlencoded', 'Content-Type 为 urlencoded');
            const params = new URLSearchParams(received.body);
            assert(params.has('username') && params.has('password'), '表单字段全部到达服务端', `实际正文: ${received.body}`);
        }

        console.log('\n=== cURL 语义验证（multipart 文本 + 文件） ===');
        {
            requests.length = 0;
            let command = converter.generate(makeCopyInfo({
                httpMethod: 'POST',
                contentType: 'form-data',
                path: '/upload',
                parameters: [
                    makeParameter({ name: 'note', source: 'form' }),
                    makeParameter({ name: 'file', type: 'MultipartFile', source: 'form' })
                ]
            }), baseUrl);
            assert(command.includes(`-F 'file=@/path/to/file'`), '文件参数输出 -F file=@ 占位');
            // 用真实临时文件替换占位路径，验证分段结构而非占位字符串
            command = command.replace('/path/to/file', tmpFile);
            await runCommand(command);
            const received = requests[0];
            assert(
                (received.headers['content-type'] || '').startsWith('multipart/form-data'),
                'Content-Type 由 curl 生成并携带 boundary',
                `实际 Content-Type: ${received.headers['content-type']}`
            );
            const parts = parseMultipart(received.headers['content-type'], received.body);
            assert(parts && parts.length === 2, 'multipart 分段数量为 2', `实际分段: ${JSON.stringify(parts)}`);
            const notePart = parts ? parts.find(part => part.name === 'note') : null;
            const filePart = parts ? parts.find(part => part.name === 'file') : null;
            assert(!!notePart, '文本字段 note 作为独立分段到达');
            assert(!!filePart && filePart.filename !== null, '文件字段携带 filename');
            assert(
                !!filePart && filePart.content === 'file-payload-42',
                '文件分段内容为真实文件内容',
                `实际内容: ${filePart ? filePart.content : '无'}`
            );
        }

        console.log('\n=== cURL 语义验证（请求头参数） ===');
        {
            requests.length = 0;
            const command = converter.generate(makeCopyInfo({
                httpMethod: 'GET',
                contentType: 'url-params',
                path: '/secure',
                parameters: [
                    makeParameter({
                        name: 'X-Api-Key', source: 'header', isRequired: true, defaultValue: 'secret-42'
                    })
                ]
            }), baseUrl);
            await runCommand(command);
            const received = requests[0];
            assertEqual(received.headers['x-api-key'], 'secret-42', '请求头参数到达服务端');
        }

        console.log('\n=== cURL 语义验证（Shell 单引号转义往返） ===');
        {
            requests.length = 0;
            const trickyValue = "it's a test";
            const command = converter.generate(makeCopyInfo({
                httpMethod: 'GET',
                contentType: 'url-params',
                path: '/trace',
                parameters: [
                    makeParameter({
                        name: 'X-Trace', source: 'header', isRequired: true, defaultValue: trickyValue
                    })
                ]
            }), baseUrl);
            await runCommand(command);
            const received = requests[0];
            assertEqual(received.headers['x-trace'], trickyValue, '含单引号的头部值经 shell 转义后原样到达');
        }
    } finally {
        fs.rmSync(tmpFile, { force: true });
        server.close();
    }

    console.log(`\n📊 cURL 语义验证: 总计 ${totalTests}，通过 ${passed}，失败 ${failed}`);
    if (failed > 0) {
        console.log('\n❌ 失败明细:');
        for (const error of errors) {
            console.log(`   - ${error.test}: ${error.message}`);
        }
        process.exit(1);
    }
    console.log('✅ 所有 cURL 语义验证通过！');
}

main().catch(error => {
    console.error('❌ cURL 语义验证脚本异常:', error);
    process.exit(1);
});
