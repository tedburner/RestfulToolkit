/**
 * 参数复制功能批量测试脚本
 *
 * 用途：
 * - 验证 ParameterExtractor 能否正确提取各种参数场景
 * - 验证 FormatConverter 输出格式是否正确
 * - 验证 DtoFieldExtractor 能否正确解析 DTO 字段
 * - 验证 @JsonProperty、@JsonNaming、@JsonAlias 注解
 *
 * 运行方法：从项目根目录运行
 *   node src/test/scripts/test-parameter-copy.js
 */

const fs = require('fs');
const path = require('path');

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '../../..');
process.chdir(projectRoot);

// 加载模块
const { SpringParameterParser } = require(path.join(projectRoot, 'dist/extractor/SpringParameterParser'));
const { JaxRsParameterParser } = require(path.join(projectRoot, 'dist/extractor/JaxRsParameterParser'));
const { FormatConverter } = require(path.join(projectRoot, 'dist/extractor/FormatConverter'));
const { DtoFieldExtractor } = require(path.join(projectRoot, 'dist/extractor/DtoFieldExtractor'));

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

console.log('=== 参数复制功能批量测试 ===\n');

// ===== 1. SpringParameterParser 测试 =====
console.log('--- 1. Spring 参数解析 ---');
const springParser = new SpringParameterParser();

{
    // @RequestParam 裸写
    const sig = 'public String search(@RequestParam String keyword)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@RequestParam 裸写', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'keyword', '@RequestParam 裸写 name', `期望 "keyword"，实际 "${params[0].name}"`);
    assert(params[0].source === 'query', '@RequestParam source', `期望 "query"，实际 "${params[0].source}"`);
}

{
    // @RequestParam 显式 name
    const sig = 'public String list(@RequestParam("user_name") String userName)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@RequestParam 显式 name', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'user_name', '@RequestParam 显式 name 值', `期望 "user_name"，实际 "${params[0].name}"`);
}

{
    // @RequestParam 含 defaultValue
    const sig = 'public String page(@RequestParam(value = "page", defaultValue = "1") int page)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@RequestParam defaultValue', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'page', '@RequestParam defaultValue name', `期望 "page"，实际 "${params[0].name}"`);
    assert(params[0].defaultValue === '1', '@RequestParam defaultValue 值', `期望 "1"，实际 "${params[0].defaultValue}"`);
    assert(params[0].isRequired === false, '@RequestParam defaultValue isRequired', `期望 false，实际 ${params[0].isRequired}`);
}

{
    // @PathVariable
    const sig = 'public String getItem(@PathVariable Long id)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@PathVariable 裸写', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'id', '@PathVariable 裸写 name', `期望 "id"，实际 "${params[0].name}"`);
    assert(params[0].source === 'path', '@PathVariable source', `期望 "path"，实际 "${params[0].source}"`);
}

{
    // @PathVariable 显式 name
    const sig = 'public String getUser(@PathVariable("user_id") Long userId)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@PathVariable 显式 name', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'user_id', '@PathVariable 显式 name 值', `期望 "user_id"，实际 "${params[0].name}"`);
}

{
    // @RequestBody
    const sig = 'public String create(@RequestBody UserDto userDto)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@RequestBody', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'userDto', '@RequestBody name', `期望 "userDto"，实际 "${params[0].name}"`);
    assert(params[0].source === 'body', '@RequestBody source', `期望 "body"，实际 "${params[0].source}"`);
    assert(params[0].type === 'UserDto', '@RequestBody type', `期望 "UserDto"，实际 "${params[0].type}"`);
}

{
    // @RequestPart (multipart)
    const sig = 'public String upload(@RequestPart("file") MultipartFile file)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@RequestPart', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].source === 'form', '@RequestPart source', `期望 "form"，实际 "${params[0].source}"`);
}

{
    // @ModelAttribute
    const sig = 'public String submitForm(@ModelAttribute LoginForm form)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 1, '@ModelAttribute', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].source === 'form', '@ModelAttribute source', `期望 "form"，实际 "${params[0].source}"`);
}

{
    // 多参数混合
    const sig = 'public String update(@PathVariable Long userId, @RequestParam String action, @RequestBody UserDto userDto)';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 3, '多参数混合', `期望 3 个参数，实际 ${params.length}`);
    assert(params[0].source === 'path', '参数1 source', `期望 "path"，实际 "${params[0].source}"`);
    assert(params[1].source === 'query', '参数2 source', `期望 "query"，实际 "${params[1].source}"`);
    assert(params[2].source === 'body', '参数3 source', `期望 "body"，实际 "${params[2].source}"`);
}

{
    // 无参数
    const sig = 'public String health()';
    const params = springParser.parseMethodParameters(sig);
    assert(params.length === 0, '无参数', `期望 0 个参数，实际 ${params.length}`);
}

// ===== 2. JaxRsParameterParser 测试 =====
console.log('\n--- 2. JAX-RS 参数解析 ---');
const jaxRsParser = new JaxRsParameterParser();

{
    const sig = 'public String getOrder(@PathParam("id") Long id)';
    const params = jaxRsParser.parseMethodParameters(sig);
    assert(params.length === 1, '@PathParam', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'id', '@PathParam name', `期望 "id"，实际 "${params[0].name}"`);
    assert(params[0].source === 'path', '@PathParam source', `期望 "path"，实际 "${params[0].source}"`);
}

{
    const sig = 'public String search(@QueryParam("keyword") String keyword)';
    const params = jaxRsParser.parseMethodParameters(sig);
    assert(params.length === 1, '@QueryParam', `期望 1 个参数，实际 ${params.length}`);
    assert(params[0].name === 'keyword', '@QueryParam name', `期望 "keyword"，实际 "${params[0].name}"`);
    assert(params[0].source === 'query', '@QueryParam source', `期望 "query"，实际 "${params[0].source}"`);
}

{
    const sig = 'public String submit(@FormParam("username") String username, @FormParam("email") String email)';
    const params = jaxRsParser.parseMethodParameters(sig);
    assert(params.length === 2, '@FormParam 多参数', `期望 2 个参数，实际 ${params.length}`);
    assert(params[0].name === 'username', '@FormParam 参数1', `期望 "username"，实际 "${params[0].name}"`);
    assert(params[0].source === 'form', '@FormParam source', `期望 "form"，实际 "${params[0].source}"`);
}

{
    // JAX-RS 中的 @RequestBody（混合使用）
    const sig = 'public String update(@PathParam("id") Long id, @RequestBody OrderDto order)';
    const params = jaxRsParser.parseMethodParameters(sig);
    assert(params.length === 2, 'JAX-RS 混合 @RequestBody', `期望 2 个参数，实际 ${params.length}`);
    assert(params[1].source === 'body', '@RequestBody source (JAX-RS)', `期望 "body"，实际 "${params[1].source}"`);
}

// ===== 3. DtoFieldExtractor 测试 =====
console.log('\n--- 3. DTO 字段解析 ---');
const dtoExtractor = new DtoFieldExtractor();

{
    // @JsonProperty
    const content = fs.readFileSync('./test-project/src/main/java/com/example/dto/UserDto.java', 'utf-8');
    const fields = dtoExtractor.parseDtoFields(content);
    assert(fields.length === 4, 'UserDto 字段数', `期望 4 个，实际 ${fields.length}`);
    const email = fields.find(f => f.originalName === 'email');
    assert(email && email.name === 'email_addr', 'UserDto @JsonProperty email', `期望 "email_addr"，实际 "${email?.name}"`);
    assert(fields.find(f => f.name === 'userName'), 'UserDto userName 字段', '未找到 userName 字段');
}

{
    // OrderDto 嵌套字段
    const content = fs.readFileSync('./test-project/src/main/java/com/example/dto/OrderDto.java', 'utf-8');
    const fields = dtoExtractor.parseDtoFields(content);
    assert(fields.length === 5, 'OrderDto 字段数', `期望 5 个，实际 ${fields.length}`);
    const user = fields.find(f => f.originalName === 'user');
    assert(user && user.type === 'UserDto', 'OrderDto user 类型', `期望 "UserDto"，实际 "${user?.type}"`);
    const addr = fields.find(f => f.originalName === 'shippingAddress');
    assert(addr && addr.type === 'AddressDto', 'OrderDto shippingAddress 类型', `期望 "AddressDto"，实际 "${addr?.type}"`);
    const addrDto = fs.readFileSync('./test-project/src/main/java/com/example/dto/AddressDto.java', 'utf-8');
    const addrFields = dtoExtractor.parseDtoFields(addrDto);
    assert(addrFields.length === 3, 'AddressDto 字段数', `期望 3 个，实际 ${addrFields.length}`);
    assert(addrFields.find(f => f.name === 'street'), 'AddressDto street 字段', '未找到 street 字段');
    assert(addrFields.find(f => f.name === 'city'), 'AddressDto city 字段', '未找到 city 字段');
    assert(addrFields.find(f => f.name === 'zipCode'), 'AddressDto zipCode 字段', '未找到 zipCode 字段');
}

{
    // @JsonNaming SnakeCaseStrategy
    const content = fs.readFileSync('./test-project/src/main/java/com/example/dto/SnakeCaseDto.java', 'utf-8');
    const fields = dtoExtractor.parseDtoFields(content);
    assert(fields.length === 4, 'SnakeCaseDto 字段数', `期望 4 个，实际 ${fields.length}`);
    assert(fields[0].name === 'user_id', 'SnakeCaseDto userId->user_id', `期望 "user_id"，实际 "${fields[0].name}"`);
    assert(fields[1].name === 'user_name', 'SnakeCaseDto userName->user_name', `期望 "user_name"，实际 "${fields[1].name}"`);
    assert(fields[2].name === 'email_address', 'SnakeCaseDto emailAddress->email_address', `期望 "email_address"，实际 "${fields[2].name}"`);
    assert(fields[3].name === 'phone_number', 'SnakeCaseDto phoneNumber->phone_number', `期望 "phone_number"，实际 "${fields[3].name}"`);
}

{
    // @JsonAlias + @JsonProperty 优先级
    const content = fs.readFileSync('./test-project/src/main/java/com/example/dto/AliasDto.java', 'utf-8');
    const fields = dtoExtractor.parseDtoFields(content);
    assert(fields.length === 3, 'AliasDto 字段数', `期望 3 个，实际 ${fields.length}`);
    const firstName = fields.find(f => f.originalName === 'firstName');
    assert(firstName && firstName.name === 'first_name', 'AliasDto @JsonAlias firstName', `期望 "first_name"，实际 "${firstName?.name}"`);
    const fullName = fields.find(f => f.originalName === 'fullName');
    assert(fullName && fullName.name === 'full_name', 'AliasDto @JsonProperty 优先于 @JsonAlias', `期望 "full_name"，实际 "${fullName?.name}"`);
    const age = fields.find(f => f.originalName === 'age');
    assert(age && age.name === 'age', 'AliasDto 无注解用原始名', `期望 "age"，实际 "${age?.name}"`);
}

// ===== 4. FormatConverter 测试 =====
console.log('\n--- 4. 格式转换 ---');
const converter = new FormatConverter();

{
    // URL Params
    const info = {
        httpMethod: 'GET', contentType: 'url-params', path: '/api/test/search',
        parameters: [{ name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: true }],
        framework: 'Spring', dtoFields: new Map()
    };
    const result = converter.toUrlParams(info);
    assert(result === '?keyword=', 'URL Params 单参数', `期望 "?keyword="，实际 "${result}"`);
}

{
    // JSON Body (DTO 展开)
    const dtoFields = new Map();
    dtoFields.set('UserDto', [
        { name: 'id', type: 'Long', originalName: 'id' },
        { name: 'userName', type: 'String', originalName: 'userName' },
        { name: 'email_addr', type: 'String', originalName: 'email' },
        { name: 'phone', type: 'String', originalName: 'phone' }
    ]);
    const info = {
        httpMethod: 'POST', contentType: 'json', path: '/api/test/users',
        parameters: [{ name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }],
        framework: 'Spring', dtoFields
    };
    const result = converter.toJsonBody(info);
    const expected = '{"id": "", "userName": "", "email_addr": "", "phone": ""}';
    assert(result === expected, 'JSON Body DTO 展开', `期望 "${expected}"，实际 "${result}"`);
}

{
    // JSON Body (@JsonNaming SnakeCase)
    const snakeFields = new Map();
    snakeFields.set('SnakeCaseDto', [
        { name: 'user_id', type: 'Long', originalName: 'userId' },
        { name: 'user_name', type: 'String', originalName: 'userName' },
        { name: 'email_address', type: 'String', originalName: 'emailAddress' },
        { name: 'phone_number', type: 'String', originalName: 'phoneNumber' }
    ]);
    const info = {
        httpMethod: 'POST', contentType: 'json', path: '/api/test/snake',
        parameters: [{ name: 'dto', type: 'SnakeCaseDto', source: 'body', originalCaseName: 'dto', isRequired: true }],
        framework: 'Spring', dtoFields: snakeFields
    };
    const result = converter.toJsonBody(info);
    const expected = '{"user_id": "", "user_name": "", "email_address": "", "phone_number": ""}';
    assert(result === expected, 'JSON Body @JsonNaming SnakeCase', `期望 "${expected}"，实际 "${result}"`);
}

{
    // JSON Body (@JsonAlias)
    const aliasFields = new Map();
    aliasFields.set('AliasDto', [
        { name: 'first_name', type: 'String', originalName: 'firstName' },
        { name: 'full_name', type: 'String', originalName: 'fullName' },
        { name: 'age', type: 'Integer', originalName: 'age' }
    ]);
    const info = {
        httpMethod: 'POST', contentType: 'json', path: '/api/test/alias',
        parameters: [{ name: 'dto', type: 'AliasDto', source: 'body', originalCaseName: 'dto', isRequired: true }],
        framework: 'Spring', dtoFields: aliasFields
    };
    const result = converter.toJsonBody(info);
    const expected = '{"first_name": "", "full_name": "", "age": ""}';
    assert(result === expected, 'JSON Body @JsonAlias', `期望 "${expected}"，实际 "${result}"`);
}

{
    // Form Data
    const info = {
        httpMethod: 'POST', contentType: 'form-data', path: '/api/test/upload',
        parameters: [
            { name: 'file', type: 'MultipartFile', source: 'form', originalCaseName: 'file', isRequired: true },
            { name: 'description', type: 'String', source: 'query', originalCaseName: 'desc', isRequired: true }
        ],
        framework: 'Spring', dtoFields: new Map()
    };
    const result = converter.toFormData(info);
    assert(result === 'file: \ndescription: ', 'Form Data 普通参数', `期望 "file: \\ndescription: "，实际 "${result}"`);
}

{
    // Form Data: @ModelAttribute DTO 展开
    const dtoFields = new Map();
    dtoFields.set('LoginForm', [
        { name: 'user_name', type: 'String', originalName: 'userName' },
        { name: 'password', type: 'String', originalName: 'password' }
    ]);
    const info = {
        httpMethod: 'POST', contentType: 'json', path: '/api/test/form',
        parameters: [
            { name: 'form', type: 'LoginForm', source: 'form', originalCaseName: 'form', isRequired: true }
        ],
        framework: 'Spring', dtoFields
    };
    const formDataResult = converter.toFormData(info);
    assert(formDataResult === 'user_name: \npassword: ', 'Form Data @ModelAttribute DTO 展开', `期望 "user_name: \\npassword: "，实际 "${formDataResult}"`);
    const formUrlResult = converter.toFormUrlencoded(info);
    assert(formUrlResult === 'user_name=&password=', 'x-www-form-urlencoded @ModelAttribute DTO 展开', `期望 "user_name=&password="，实际 "${formUrlResult}"`);
}

{
    // x-www-form-urlencoded
    const info = {
        httpMethod: 'POST', contentType: 'x-www-form-urlencoded', path: '/api/test/login',
        parameters: [
            { name: 'username', type: 'String', source: 'query', originalCaseName: 'username', isRequired: true },
            { name: 'password', type: 'String', source: 'query', originalCaseName: 'password', isRequired: true }
        ],
        framework: 'Spring', dtoFields: new Map()
    };
    const result = converter.toFormUrlencoded(info);
    assert(result === 'username=&password=', 'x-www-form-urlencoded', `期望 "username=&password="，实际 "${result}"`);
}

{
    // URL Params 多参数
    const info = {
        httpMethod: 'POST', contentType: 'x-www-form-urlencoded', path: '/api/test/login',
        parameters: [
            { name: 'username', type: 'String', source: 'query', originalCaseName: 'username', isRequired: true },
            { name: 'password', type: 'String', source: 'query', originalCaseName: 'password', isRequired: true }
        ],
        framework: 'Spring', dtoFields: new Map()
    };
    const result = converter.toUrlParams(info);
    assert(result === '?username=&password=', 'URL Params 多参数', `期望 "?username=&password="，实际 "${result}"`);
}

{
    // JSON Body: 混合参数 (path + body) — 只展开 body 的 DTO，忽略 path/query 参数
    const dtoFields = new Map();
    dtoFields.set('UserDto', [
        { name: 'id', type: 'Long', originalName: 'id' },
        { name: 'userName', type: 'String', originalName: 'userName' }
    ]);
    const info = {
        httpMethod: 'PUT', contentType: 'json', path: '/api/test/users/{userId}',
        parameters: [
            { name: 'userId', type: 'Long', source: 'path', originalCaseName: 'userId', isRequired: true },
            { name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
        ],
        framework: 'Spring', dtoFields
    };
    const result = converter.toJsonBody(info);
    const expected = '{"id": "", "userName": ""}';
    assert(result === expected, 'JSON Body 混合参数 (path+body)', `期望 "${expected}"，实际 "${result}"`);
}

{
    // JSON Body: 嵌套 DTO — 展开嵌套对象
    const dtoFields = new Map();
    dtoFields.set('NestedDto', [
        { name: 'id', type: 'Long', originalName: 'id' },
        { name: 'name', type: 'String', originalName: 'name' },
        { name: 'address', type: 'AddressDto', originalName: 'address', nested: [
            { name: 'street', type: 'String', originalName: 'street' },
            { name: 'city', type: 'String', originalName: 'city' },
            { name: 'zipCode', type: 'String', originalName: 'zipCode' }
        ]}
    ]);
    const info = {
        httpMethod: 'POST', contentType: 'json', path: '/api/test/nested',
        parameters: [{ name: 'dto', type: 'NestedDto', source: 'body', originalCaseName: 'dto', isRequired: true }],
        framework: 'Spring', dtoFields
    };
    const result = converter.toJsonBody(info);
    const expected = '{"id": "", "name": "", "address": {"street": "", "city": "", "zipCode": ""}}';
    assert(result === expected, 'JSON Body 嵌套 DTO', `期望 "${expected}"，实际 "${result}"`);
}

{
    // JSON Body: 多层嵌套 (3 层)
    const dtoFields = new Map();
    dtoFields.set('DeepDto', [
        { name: 'level1', type: 'String', originalName: 'level1' },
        { name: 'l2', type: 'Level2Dto', originalName: 'l2', nested: [
            { name: 'level2a', type: 'String', originalName: 'level2a' },
            { name: 'l3', type: 'Level3Dto', originalName: 'l3', nested: [
                { name: 'level3a', type: 'String', originalName: 'level3a' }
            ]}
        ]}
    ]);
    const info = {
        httpMethod: 'POST', contentType: 'json', path: '/api/test/deep',
        parameters: [{ name: 'dto', type: 'DeepDto', source: 'body', originalCaseName: 'dto', isRequired: true }],
        framework: 'Spring', dtoFields
    };
    const result = converter.toJsonBody(info);
    const expected = '{"level1": "", "l2": {"level2a": "", "l3": {"level3a": ""}}}';
    assert(result === expected, 'JSON Body 多层嵌套 (3层)', `期望 "${expected}"，实际 "${result}"`);
}

// ===== 5. DTO 文件完整性检查 =====
console.log('\n--- 5. DTO 文件完整性检查 ---');

{
    // 扫描所有 controller 文件，提取引用的 DTO 类型
    const dtoDir = './test-project/src/main/java/com/example/dto';
    const controllerDir = './test-project/src/main/java/com/example/controller';

    const existingDtos = new Set(fs.readdirSync(dtoDir).filter(f => f.endsWith('.java')).map(f => f.replace('.java', '')));

    // 从 controller 文件中提取 DTO 类型引用（import + 方法签名中的类型）
    const referencedDtos = new Set();
    const controllerFiles = fs.readdirSync(controllerDir).filter(f => f.endsWith('.java'));

    for (const file of controllerFiles) {
        const content = fs.readFileSync(path.join(controllerDir, file), 'utf-8');
        // 提取 import com.example.dto.Xxx
        const importMatches = content.matchAll(/import com\.example\.dto\.(\w+);/g);
        for (const m of importMatches) { referencedDtos.add(m[1]); }
        // 提取 @RequestBody / @ModelAttribute / @RequestPart 后面的类型（Type varName 中的 Type）
        const paramMatches = content.matchAll(/@(?:RequestBody|ModelAttribute|RequestPart)(?:\([^)]*\))?\s+(\w+)\s+\w+/g);
        for (const m of paramMatches) { referencedDtos.add(m[1]); }
    }

    // 排除基本类型和 Spring 内置类型
    const skipTypes = new Set(['String', 'Long', 'Integer', 'Boolean', 'Double', 'Float', 'Short', 'Byte',
        'MultipartFile', 'File', 'InputStream', 'Map', 'List', 'Set', 'Object']);

    // 检查每个引用的 DTO 是否有对应文件
    for (const dto of referencedDtos) {
        if (skipTypes.has(dto)) { continue; }
        assert(existingDtos.has(dto), `DTO 文件存在: ${dto}.java`, `缺少 ${dto}.java`);
    }
    console.log(`   📁 已存在 DTO 文件: ${Array.from(existingDtos).join(', ')}`);
    console.log(`   📋 Controller 引用 DTO: ${Array.from(referencedDtos).join(', ')}`);
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
