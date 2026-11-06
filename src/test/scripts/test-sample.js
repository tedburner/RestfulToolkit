const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '../../..');
require('./lib/dist-check').ensureFreshDist();
process.chdir(root);
require(path.join(root, 'src/test/scripts/mock-vscode'));
const vscode = require('vscode');
const { AnnotationParser } = require(path.join(root, 'dist/parsers/AnnotationParser'));
const { ParameterExtractor } = require(path.join(root, 'dist/extractor/ParameterExtractor'));
const { CurlConverter } = require(path.join(root, 'dist/extractor/CurlConverter'));
const { BaseUrlResolver } = require(path.join(root, 'dist/utils/BaseUrlResolver'));
const { JsonClassGenerator } = require(path.join(root, 'dist/generator/JsonClassGenerator'));

const sampleRoot = path.join(root, 'test-sample');
const mainDir = path.join(sampleRoot, 'src/main');
const allFiles = [];
(function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); } else { allFiles.push(full); }
    }
})(mainDir);

// VS Code 原生 findFiles 支持 `{java,kt}`，mock 不支持，这里按真实语义补上
vscode.workspace.findFiles = async (include) => {
    const dtoMatch = include.match(/\*\*\/([A-Za-z0-9_]+)\.\{java,kt\}/);
    if (dtoMatch) {
        const name = dtoMatch[1];
        return allFiles
            .filter(file => path.basename(file) === `${name}.java` || path.basename(file) === `${name}.kt`)
            .map(file => ({ fsPath: file }));
    }
    return [];
};

const results = [];
function check(name, condition, detail = '') {
    results.push({ name, ok: Boolean(condition), detail });
    console.log(`${condition ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

(async () => {
    const parser = new AnnotationParser();
    const byFile = new Map();
    let total = 0;
    for (const file of allFiles.filter(file => /\.(java|kt)$/.test(file))) {
        const endpoints = parser.parseFile(fs.readFileSync(file, 'utf8'), file);
        const name = path.basename(file);
        byFile.set(name, endpoints);
        if (!file.includes(`${path.sep}ignored${path.sep}`)) { total += endpoints.length; }
    }

    const expectedCounts = {
        'UserController.java': 16,
        'NestedAndEdgeController.java': 9,
        'UploadController.java': 3,
        'ItemController.kt': 8,
        'OrderResource.java': 6,
        'ContractApi.java': 2,
        'IgnoredController.java': 1
    };
    for (const [file, expected] of Object.entries(expectedCounts)) {
        const actual = (byFile.get(file) ?? []).length;
        check(`端点数量 ${file}`, actual === expected, `期望 ${expected}，实际 ${actual}`);
    }
    check('排除 ignored 后总端点数为 44', total === 44, `实际 ${total}`);

    const edge = byFile.get('NestedAndEdgeController.java') ?? [];
    const parenPaths = edge.filter(endpoint => endpoint.methodName === 'paren').map(endpoint => endpoint.path).sort();
    check('路径内括号不破坏解析', JSON.stringify(parenPaths) === JSON.stringify(['/api/edge/a(b)', '/api/edge/plain']), parenPaths.join(', '));

    const inner = edge.find(endpoint => endpoint.className === 'Inner');
    const rootApi = edge.find(endpoint => endpoint.className === 'RootApi');
    check('嵌套类端点归属 Inner', inner?.path === '/inner', inner ? `${inner.className}#${inner.methodName} ${inner.path}` : '未找到');
    check('无类级路径的嵌套类挂载根路径', rootApi?.path === '/root', rootApi ? `${rootApi.className}#${rootApi.methodName} ${rootApi.path}` : '未找到');
    check('内层端点不归属外层类', !edge.some(endpoint => endpoint.className === 'NestedAndEdgeController' && endpoint.path === '/inner'));

    const edgeLines = fs.readFileSync(path.join(mainDir, 'java/com/example/sample/NestedAndEdgeController.java'), 'utf8').split('\n');
    const compactGet = edge.find(endpoint => endpoint.methodName === 'compactGet');
    const compactPost = edge.find(endpoint => endpoint.methodName === 'compactPost');
    check('同行注解行号指向注解',
        edgeLines[compactGet.line - 1].trim().startsWith('@GetMapping')
        && edgeLines[compactPost.line - 1].trim().startsWith('@PostMapping'),
        `L${compactGet.line} / L${compactPost.line}`);

    const extractor = new ParameterExtractor();
    const converter = new CurlConverter();
    const uploadFile = path.join(mainDir, 'java/com/example/sample/UploadController.java');
    const uploadText = fs.readFileSync(uploadFile, 'utf8');
    const uploadDoc = { getText: () => uploadText, uri: vscode.Uri.file(uploadFile) };

    const multipartInfo = await extractor.extract(uploadDoc, { line: 18, character: 8 }, { expandDto: false });
    const multipartCurl = converter.generate(multipartInfo, 'http://localhost:8080/sample');
    check('multipart 文件字段全部识别',
        ['file', 'gallery', 'legacyFile', 'avatar'].every(name => multipartCurl.includes(`-F '${name}=@/path/to/file'`)),
        multipartCurl.replace(/\n/g, ' '));
    check('multipart 请求头参数保留', multipartCurl.includes("-H 'X-Token: '"));
    check('multipart 不手写 Content-Type', !multipartCurl.includes('multipart/form-data'));

    const wrapperInfo = await extractor.extract(uploadDoc, { line: 29, character: 8 }, { expandDto: false });
    const wrapperCurl = converter.generate(wrapperInfo, 'http://localhost:8080/sample');
    check('ResourceWrapper/ResourceLoader 不被误判为文件',
        !wrapperCurl.includes('@/path/to/file')
        && wrapperCurl.includes("-F 'wrapper='")
        && wrapperCurl.includes("-F 'loader='"),
        wrapperCurl.replace(/\n/g, ' '));

    const formInfo = await extractor.extract(uploadDoc, { line: 36, character: 8 }, { expandDto: false });
    const formCurl = converter.generate(formInfo, 'http://localhost:8080/sample');
    check('urlencoded 参数进入正文而非 URL',
        formCurl.includes("-d 'name=&age='")
        && formCurl.includes('application/x-www-form-urlencoded')
        && !formCurl.includes('/form?'),
        formCurl.replace(/\n/g, ' '));

    const userFile = path.join(mainDir, 'java/com/example/sample/UserController.java');
    const userText = fs.readFileSync(userFile, 'utf8');
    const userDoc = { getText: () => userText, uri: vscode.Uri.file(userFile) };
    const createInfo = await extractor.extract(userDoc, { line: 31, character: 8 }, { expandDto: true });
    const createCurl = converter.generate(createInfo, 'http://localhost:8080/sample');
    check('DTO 展开包含 @JsonProperty 命名', createCurl.includes('"email_address": ""'), createCurl.replace(/\n/g, ' '));
    check('DTO 嵌套字段展开', createCurl.includes('"address": {"street": "", "city": "", "zipCode": ""}'), '');
    check('cURL JSON 正文使用单引号安全转义', createCurl.includes("-d '{\"id\": \"\"") && createCurl.includes("-H 'Content-Type: application/json'"));

    const baseUrl = await new BaseUrlResolver().resolveAsync(sampleRoot);
    check('application.yml Base URL 解析',
        baseUrl?.host === 'localhost' && baseUrl?.port === '8080' && baseUrl?.contextPath === '/sample',
        JSON.stringify(baseUrl));

    const generator = new JsonClassGenerator();
    const json = fs.readFileSync(path.join(sampleRoot, 'payloads/create-order.json'), 'utf8');
    const javaDto = generator.generate(json, 'CreateOrderRequest', 'com.example.sample.dto', 'java');
    const kotlinDto = generator.generate(json, 'CreateOrderRequest', 'com.example.sample.dto', 'kotlin');
    check('Java DTO 规避硬关键字', javaDto.includes('private String class2;')
        && javaDto.includes('private Boolean default2;')
        && javaDto.includes('private Object package2;'),
        'class2/default2/package2');
    check('Java DTO 保留原始 JSON key', javaDto.includes('@JsonProperty("class")') && javaDto.includes('@JsonProperty("package")'));
    check('Kotlin DTO 规避硬关键字并保留可空类型', kotlinDto.includes('val class2: String,')
        && kotlinDto.includes('val package2: Any?,')
        && kotlinDto.includes('val emptyList: List<Any?>,')
        && kotlinDto.includes('val nullable: Any?\n'));

    const failed = results.filter(result => !result.ok);
    console.log(`\n=== 样例项目验证汇总：${results.length - failed.length}/${results.length} 通过 ===`);
    if (failed.length > 0) {
        console.error('失败项：');
        for (const failure of failed) { console.error(` - ${failure.name} ${failure.detail}`); }
        process.exit(1);
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
