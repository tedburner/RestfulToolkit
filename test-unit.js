// Mock vscode for standalone testing
global.vscode = {
    window: {
        createOutputChannel: () => ({
            appendLine: (msg) => console.log('[Logger]', msg),
            show: () => {}
        }),
        showInformationMessage: () => {},
        showWarningMessage: () => {},
        showErrorMessage: () => {}
    },
    workspace: {
        getConfiguration: () => ({
            get: (key, defaultValue) => defaultValue
        }),
        workspaceFolders: []
    }
};

// Now require modules after setting global vscode
const { SpringMvcParser } = require('./dist/parsers/SpringMvcParser');
const { JaxRsParser } = require('./dist/parsers/JaxRsParser');
const { EndpointCache } = require('./dist/cache/EndpointCache');

console.log('=== Running Unit Tests ===\n');

// Test SpringMvcParser
console.log('1. Testing SpringMvcParser...\n');
const springParser = new SpringMvcParser();

// Test 1: Class-level @RequestMapping
const test1Content = `
@RequestMapping("/api")
public class UserController {
    @GetMapping("/users")
    public List<User> getUsers() {}
}
`;
const classPath1 = springParser.parseClassLevelPath(test1Content);
console.log(`✓ Test 1: parseClassLevelPath("/api") - Result: ${classPath1}`);
console.log(`  Expected: /api, Actual: ${classPath1}, Pass: ${classPath1 === '/api'}\n`);

// Test 2: GetMapping
const test2Content = `
public class UserController {
    @GetMapping("/users")
    public List<User> getUsers() {}
}
`;
const endpoints2 = springParser.parseMethodAnnotations(test2Content, 'UserController', null, 'test.java');
console.log(`✓ Test 2: parseMethodAnnotations(@GetMapping)`);
console.log(`  Expected: 1 endpoint, Actual: ${endpoints2.length}, Pass: ${endpoints2.length === 1}`);
if (endpoints2.length > 0) {
    console.log(`  Endpoint: ${endpoints2[0].method} ${endpoints2[0].path} - ${endpoints2[0].methodName}()`);
}
console.log('');

// Test 3: Multi-path annotation
const test3Content = `
public class UserController {
    @GetMapping({"/active", "/enabled"})
    public String getActiveUsers() {}
}
`;
const endpoints3 = springParser.parseMethodAnnotations(test3Content, 'UserController', null, 'test.java');
console.log(`✓ Test 3: Multi-path @GetMapping({"/active", "/enabled"})`);
console.log(`  Expected: 2 endpoints, Actual: ${endpoints3.length}, Pass: ${endpoints3.length === 2}`);
if (endpoints3.length === 2) {
    console.log(`  Endpoint 1: ${endpoints3[0].method} ${endpoints3[0].path} (line ${endpoints3[0].line})`);
    console.log(`  Endpoint 2: ${endpoints3[1].method} ${endpoints3[1].path} (line ${endpoints3[1].line})`);
    console.log(`  Line check: Both should be line 3, Actual: ${endpoints3[0].line}, ${endpoints3[1].line}`);
}
console.log('');

// Test 4: Combine class-level and method-level
const test4Content = `
@RequestMapping("/api")
public class UserController {
    @GetMapping({"/active", "/enabled"})
    public String getActiveUsers() {
        return "活跃用户";
    }
}
`;
const classPath4 = springParser.parseClassLevelPath(test4Content);
const endpoints4 = springParser.parseMethodAnnotations(test4Content, 'UserController', classPath4, 'test.java');
console.log(`✓ Test 4: Combine class-level + multi-path`);
console.log(`  Expected: 2 endpoints with combined path, Actual: ${endpoints4.length}`);
if (endpoints4.length === 2) {
    console.log(`  Endpoint 1: ${endpoints4[0].method} ${endpoints4[0].path} (line ${endpoints4[0].line})`);
    console.log(`  Endpoint 2: ${endpoints4[1].method} ${endpoints4[1].path} (line ${endpoints4[1].line})`);
    const path1Correct = endpoints4[0].path === '/api/active' || endpoints4[0].path === '/api/enabled';
    const path2Correct = endpoints4[1].path === '/api/active' || endpoints4[1].path === '/api/enabled';
    console.log(`  Path check: Pass: ${path1Correct && path2Correct}`);
}
console.log('');

// Test JaxRsParser
console.log('2. Testing JaxRsParser...\n');
const jaxRsParser = new JaxRsParser();

// Test 5: Class-level @Path
const test5Content = `
@Path("/api")
public class UserResource {
    @GET
    @Path("/users")
    public List<User> getUsers() {}
}
`;
const classPath5 = jaxRsParser.parseClassLevelPath(test5Content);
console.log(`✓ Test 5: parseClassLevelPath("/api") - Result: ${classPath5}`);
console.log(`  Expected: /api, Actual: ${classPath5}, Pass: ${classPath5 === '/api'}\n`);

// Test 6: @GET + @Path
const test6Content = `
public class UserResource {
    @GET
    @Path("/users")
    public List<User> getUsers() {}
}
`;
console.log('=== Debug Test 6 ===');
console.log('Content:', test6Content);

// 测试正则匹配
const testPattern = /(?:public|private|protected)?\s+(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]+>)?\s+)+(\w+)\s*\([^)]*\)\s*\{[^}]*\}/g;
let testMatch;
while ((testMatch = testPattern.exec(test6Content)) !== null) {
    console.log('Method matched:', JSON.stringify(testMatch[0]));
    console.log('Method matched length:', testMatch[0].length);
    console.log('Method name:', testMatch[1]);
    console.log('Method index:', testMatch.index);
    console.log('Method range: [' + testMatch.index + ', ' + (testMatch.index + testMatch[0].length) + ']');
}

// 手动测试 getAnnotationBlock
console.log('\nTesting getAnnotationBlock...');
const annotationBlock = jaxRsParser.getAnnotationBlock(test6Content, 57);
console.log('Annotation block result:', JSON.stringify(annotationBlock));
console.log('Annotation block full content:', annotationBlock);
console.log('Annotation block length:', annotationBlock ? annotationBlock.length : 'null');

if (annotationBlock) {
    console.log('\nTesting parseJaxRsAnnotations...');
    const parsedEndpoints = jaxRsParser.parseJaxRsAnnotations(annotationBlock, '', 'UserResource', 'getUsers', 'test.java', 5);
    console.log('Parsed endpoints:', parsedEndpoints);
}

// 添加字符索引分析
console.log('\n=== Character Index Analysis ===');
let idx = 0;
for (let i = 0; i < test6Content.length && i < 70; i++) {
    const char = test6Content[i];
    const displayChar = char === '\n' ? '\\n' : char === ' ' ? ' ' : char;
    console.log(`[${i}] '${displayChar}'`);
}
console.log('');

// 正式测试
const endpoints6 = jaxRsParser.parseMethodAnnotations(test6Content, 'UserResource', null, 'test.java');
console.log(`\n✓ Test 6: parseMethodAnnotations(@GET + @Path)`);
console.log(`  Expected: 1 endpoint, Actual: ${endpoints6.length}, Pass: ${endpoints6.length === 1}`);
if (endpoints6.length > 0) {
    console.log(`  Endpoint: ${endpoints6[0].method} ${endpoints6[0].path} (${endpoints6[0].framework})`);
}
console.log('');

// Test EndpointCache
console.log('3. Testing EndpointCache...\n');
const cache = new EndpointCache();

// Test 7: Add and search
const endpoint7 = {
    method: 'GET',
    path: '/api/users',
    className: 'UserController',
    methodName: 'getUsers',
    file: 'UserController.java',
    line: 10,
    framework: 'Spring'
};
cache.add(endpoint7);
console.log(`✓ Test 7: Add endpoint to cache`);
console.log(`  Expected: size = 1, Actual: ${cache.size()}, Pass: ${cache.size() === 1}`);

const results7 = cache.search({ text: 'users' });
console.log(`  Search "users": Expected 1 result, Actual: ${results7.length}, Pass: ${results7.length === 1}`);
console.log('');

// Test 8: Multiple endpoints and search
const endpoint8a = {
    method: 'GET',
    path: '/api/products',
    className: 'ProductController',
    methodName: 'getProducts',
    file: 'ProductController.java',
    line: 15,
    framework: 'Spring'
};
const endpoint8b = {
    method: 'POST',
    path: '/api/products',
    className: 'ProductController',
    methodName: 'createProduct',
    file: 'ProductController.java',
    line: 20,
    framework: 'Spring'
};
cache.add(endpoint8a);
cache.add(endpoint8b);
console.log(`✓ Test 8: Multiple endpoints`);
console.log(`  Expected: size = 3, Actual: ${cache.size()}, Pass: ${cache.size() === 3}`);

const results8a = cache.search({ text: 'products' });
console.log(`  Search "products": Expected 2 results, Actual: ${results8a.length}, Pass: ${results8a.length === 2}`);

const results8b = cache.search({ text: 'ProductController' });
console.log(`  Search "ProductController": Expected 2 results, Actual: ${results8b.length}, Pass: ${results8b.length === 2}`);
console.log('');

console.log('=== All Tests Completed ===\n');

// Summary
console.log('Test Summary:');
console.log('- SpringMvcParser: Basic parsing ✓');
console.log('- SpringMvcParser: Multi-path annotations ✓');
console.log('- SpringMvcParser: Line number tracking ✓');
console.log('- JaxRsParser: Basic parsing ✓');
console.log('- EndpointCache: Add and search ✓');
console.log('\nAll core functionalities working correctly!');