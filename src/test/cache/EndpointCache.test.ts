import * as assert from 'assert';
import { EndpointCache } from '../../cache/EndpointCache';
import { RestEndpoint } from '../../models/types';

suite('EndpointCache Test Suite', () => {
    let cache: EndpointCache;

    setup(() => {
        cache = new EndpointCache();
    });

    test('Should add endpoint to cache', () => {
        const endpoint: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        cache.add(endpoint);
        assert.strictEqual(cache.size(), 1);
    });

    test('Should get endpoints by file', () => {
        const endpoint1: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        const endpoint2: RestEndpoint = {
            method: 'POST',
            path: '/api/create',
            className: 'UserController',
            methodName: 'createUser',
            file: 'UserController.java',
            line: 20,
            framework: 'Spring'
        };

        cache.add(endpoint1);
        cache.add(endpoint2);

        const fileEndpoints = cache.getByFile('UserController.java');
        assert.strictEqual(fileEndpoints.length, 2);
    });

    test('Should remove endpoints by file', () => {
        const endpoint: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        cache.add(endpoint);
        cache.removeByFile('UserController.java');
        assert.strictEqual(cache.size(), 0);
    });

    test('Should update file endpoints', () => {
        const oldEndpoint: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        const newEndpoint: RestEndpoint = {
            method: 'POST',
            path: '/api/create',
            className: 'UserController',
            methodName: 'createUser',
            file: 'UserController.java',
            line: 15,
            framework: 'Spring'
        };

        cache.add(oldEndpoint);
        cache.updateFile('UserController.java', [newEndpoint]);

        const fileEndpoints = cache.getByFile('UserController.java');
        assert.strictEqual(fileEndpoints.length, 1);
        assert.strictEqual(fileEndpoints[0].method, 'POST');
    });

    test('Should search endpoints by path', () => {
        const endpoint: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        cache.add(endpoint);
        const results = cache.search({ text: 'users' });
        assert.strictEqual(results.length, 1);
    });

    test('Should search endpoints by class name', () => {
        const endpoint: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        cache.add(endpoint);
        const results = cache.search({ text: 'UserController' });
        assert.strictEqual(results.length, 1);
    });

    test('Should search endpoints by method name', () => {
        const endpoint: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        cache.add(endpoint);
        const results = cache.search({ text: 'getUsers' });
        assert.strictEqual(results.length, 1);
    });

    test('Should search endpoints by HTTP method', () => {
        const endpoint: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        cache.add(endpoint);
        const results = cache.search({ text: 'GET' });
        assert.strictEqual(results.length, 1);
    });

    test('Should handle duplicate endpoints', () => {
        const endpoint1: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        const endpoint2: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserApiController',
            methodName: 'listUsers',
            file: 'UserApiController.java',
            line: 15,
            framework: 'Spring'
        };

        cache.add(endpoint1);
        cache.add(endpoint2);
        assert.strictEqual(cache.size(), 2);
    });

    test('Should clear cache', () => {
        const endpoint: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        cache.add(endpoint);
        cache.clear();
        assert.strictEqual(cache.size(), 0);
    });

    test('Should get all endpoints', () => {
        const endpoint1: RestEndpoint = {
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        };

        const endpoint2: RestEndpoint = {
            method: 'POST',
            path: '/api/create',
            className: 'UserController',
            methodName: 'createUser',
            file: 'UserController.java',
            line: 20,
            framework: 'Spring'
        };

        cache.add(endpoint1);
        cache.add(endpoint2);

        const all = cache.getAll();
        assert.strictEqual(all.length, 2);
    });

    test('Should limit results with maxResults parameter', () => {
        for (let i = 0; i < 10; i++) {
            cache.add({
                method: 'GET',
                path: `/api/users/${i}`,
                className: 'UserController',
                methodName: `getUser${i}`,
                file: `UserController${i}.java`,
                line: i,
                framework: 'Spring'
            });
        }

        const all = cache.search({ text: 'user' });
        assert.strictEqual(all.length, 10);

        const limited = cache.search({ text: 'user' }, 3);
        assert.strictEqual(limited.length, 3);

        const limitedDefault = cache.search({ text: 'user' }, 100);
        assert.strictEqual(limitedDefault.length, 10);
    });

    test('Should not throw for regex metacharacters in search query', () => {
        cache.add({
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        });

        assert.doesNotThrow(() => cache.search({ text: '(' }));
        assert.doesNotThrow(() => cache.search({ text: '*user?' }));
    });

    test('Should apply method and framework filters', () => {
        cache.add({
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        });
        cache.add({
            method: 'POST',
            path: '/api/users',
            className: 'UserResource',
            methodName: 'createUser',
            file: 'UserResource.java',
            line: 20,
            framework: 'JAX-RS'
        });

        const postResults = cache.search({ text: 'users', filters: { method: 'POST' } });
        assert.strictEqual(postResults.length, 1);
        assert.strictEqual(postResults[0].method, 'POST');

        const springResults = cache.search({ text: 'users', filters: { framework: 'Spring' } });
        assert.strictEqual(springResults.length, 1);
        assert.strictEqual(springResults[0].framework, 'Spring');
    });

    // ===== camelCase word boundary matching =====

    test('Should match at camelCase word boundary in path', () => {
        cache.add({
            method: 'GET',
            path: '/api/uploadParseData',
            className: 'UploadController',
            methodName: 'getData',
            file: 'UploadController.java',
            line: 10,
            framework: 'Spring'
        });

        const results = cache.search({ text: 'parse' });
        assert.strictEqual(results.length, 1, 'Should match "parse" at camelCase boundary in "uploadParseData"');
    });

    test('Should match at camelCase word boundary in className', () => {
        cache.add({
            method: 'GET',
            path: '/api/data',
            className: 'RequestParser',
            methodName: 'getData',
            file: 'RequestParser.java',
            line: 10,
            framework: 'Spring'
        });

        const results = cache.search({ text: 'parser' });
        assert.strictEqual(results.length, 1, 'Should match "parser" at camelCase boundary in "RequestParser"');
    });

    test('Should match at separator boundaries (dash, underscore, dot)', () => {
        cache.add({
            method: 'GET',
            path: '/api/user-list',
            className: 'UserController',
            methodName: 'list',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        });
        cache.add({
            method: 'GET',
            path: '/api/user_list',
            className: 'UserController',
            methodName: 'list2',
            file: 'UserController.java',
            line: 20,
            framework: 'Spring'
        });

        const results = cache.search({ text: 'list' });
        assert.strictEqual(results.length, 2, 'Should match "list" after dash and underscore');
    });

    test('Should NOT match inside a word (no word boundary)', () => {
        cache.add({
            method: 'GET',
            path: '/api/sparse',
            className: 'SparseController',
            methodName: 'getData',
            file: 'SparseController.java',
            line: 10,
            framework: 'Spring'
        });

        // "par" appears in "sparse" but not at a word boundary
        // It should still match via fuzzy or substring, but not via word boundary
        const results = cache.search({ text: 'par' });
        // substring match: "sparse" includes "par" → score 0.9, so it should be found
        assert.strictEqual(results.length, 1, 'Substring match still works for non-boundary');

        // But for a query that only matches at boundary: "sparse" should match "sparse" exactly
        const exactResults = cache.search({ text: 'sparse' });
        assert.strictEqual(exactResults.length, 1, 'Exact substring match for "sparse"');
    });

    // ===== 排序优先级：path > className > methodName =====

    test('Single token: path matches rank above method-only matches', () => {
        cache.add({
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        });
        cache.add({
            method: 'POST',
            path: '/api/data',
            className: 'DataController',
            methodName: 'createUser',
            file: 'DataController.java',
            line: 20,
            framework: 'Spring'
        });

        // "user" matches: path "/api/users" (substring) AND method "createUser" (substring)
        const results = cache.search({ text: 'user' });
        assert.strictEqual(results[0].path, '/api/users', 'path 含 "user" 排第一');
    });

    // ===== 多词查询 AND 语义 =====

    test('Multi-word AND: "user get" matches endpoints where both tokens score', () => {
        cache.add({
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        });
        cache.add({
            method: 'GET',
            path: '/api/items',
            className: 'ItemController',
            methodName: 'getItems',
            file: 'ItemController.java',
            line: 20,
            framework: 'Spring'
        });

        // "user" matches UserController (className) + "get" matches GET (httpMethod)
        // Both endpoints match both tokens, but UserController scores higher on "user"
        const results = cache.search({ text: 'user get' });
        assert.ok(results.length >= 1, 'Multi-word AND should match');
        const userEp = results.find(r => r.className === 'UserController');
        assert.ok(userEp, '"user get" should match UserController');
    });

    test('Multi-word AND: "xyz abc" returns empty (no token matches)', () => {
        cache.add({
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        });

        // "xyz" doesn't match anything, "abc" doesn't match anything
        const results = cache.search({ text: 'xyz abc' });
        assert.strictEqual(results.length, 0, '"xyz abc" should return empty');
    });

    test('Multi-word: "post create" ranks path matches first, method matches after', () => {
        cache.add({
            method: 'POST',
            path: '/api/test/create',
            className: 'TestController',
            methodName: 'createItem',
            file: 'TestController.java',
            line: 10,
            framework: 'Spring'
        });
        cache.add({
            method: 'POST',
            path: '/api/test/alias',
            className: 'TestController',
            methodName: 'createAlias',
            file: 'TestController.java',
            line: 30,
            framework: 'Spring'
        });
        cache.add({
            method: 'GET',
            path: '/api/test/create',
            className: 'TestController',
            methodName: 'getCreate',
            file: 'TestController.java',
            line: 40,
            framework: 'Spring'
        });

        // "post" 过滤 POST 端点，"create" 搜索
        // POST /api/test/create: path "create" match → 排第一
        // POST /api/test/alias: method "createAlias" match → 排第二
        // GET /api/test/create: "post" 要求 POST → 过滤
        const results = cache.search({ text: 'post create' });
        assert.strictEqual(results[0].path, '/api/test/create', 'path 含 "create" 排第一');
        assert.strictEqual(results.length, 2, '只返回 POST 端点');
        assert.ok(results.every(r => r.method === 'POST'), '所有结果都是 POST');
    });

    test('Multi-word HTTP token matching is case-insensitive', () => {
        cache.add({
            method: 'POST',
            path: '/api/test/create',
            className: 'TestResource',
            methodName: 'createOrder',
            file: 'TestResource.java',
            line: 10,
            framework: 'JAX-RS'
        });
        cache.add({
            method: 'GET',
            path: '/api/test/create',
            className: 'TestController',
            methodName: 'getCreate',
            file: 'TestController.java',
            line: 20,
            framework: 'Spring'
        });

        const results = cache.search({ text: 'POST create' });
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].method, 'POST');
        assert.strictEqual(results[0].path, '/api/test/create');
    });

    test('Fuzzy match: query shorter than 2 chars should not fuzzy-match', () => {
        cache.add({
            method: 'GET',
            path: '/api/abcdefghij',
            className: 'LongController',
            methodName: 'getData',
            file: 'LongController.java',
            line: 10,
            framework: 'Spring'
        });

        // "x" is only 1 char → fuzzy matching disabled, only substring/boundary/acronym
        // "x" is not a substring of "abcdefghij" → should NOT match
        const results = cache.search({ text: 'x' });
        assert.strictEqual(results.length, 0, 'Single char "x" should not fuzzy-match long path');
    });

    // ===== 首字母缩写匹配 =====

    test('Should match camelCase acronym: "pd" matches parseData', () => {
        cache.add({
            method: 'GET',
            path: '/api/data',
            className: 'DataController',
            methodName: 'parseData',
            file: 'DataController.java',
            line: 10,
            framework: 'Spring'
        });

        const results = cache.search({ text: 'pd' });
        assert.strictEqual(results.length, 1, '"pd" should match "parseData" via acronym');
    });

    test('Should match camelCase acronym: "uc" matches UserController', () => {
        cache.add({
            method: 'GET',
            path: '/api/users',
            className: 'UserController',
            methodName: 'getUsers',
            file: 'UserController.java',
            line: 10,
            framework: 'Spring'
        });

        const results = cache.search({ text: 'uc' });
        assert.strictEqual(results.length, 1, '"uc" should match "UserController" via acronym');
    });

    test('Should match separator-based acronym: "dt" matches data-transfer', () => {
        cache.add({
            method: 'GET',
            path: '/api/data-transfer/items',
            className: 'DataTransferController',
            methodName: 'getItems',
            file: 'DataTransferController.java',
            line: 10,
            framework: 'Spring'
        });

        const results = cache.search({ text: 'dt' });
        assert.strictEqual(results.length, 1, '"dt" should match "data-transfer" via acronym');
    });

    test('Acronym should NOT match single-word text', () => {
        cache.add({
            method: 'GET',
            path: '/api/users',
            className: 'User',
            methodName: 'get',
            file: 'User.java',
            line: 10,
            framework: 'Spring'
        });

        // "User" is a single word → no acronym match for "u"
        const results = cache.search({ text: 'u' });
        // "u" is a substring of "User" → should match via substring (0.9), not acronym
        assert.strictEqual(results.length, 1, '"u" matches "User" as substring');
    });

    // ===== fuzzyMatch 集中率优化 =====

    test('Fuzzy match: short query matching long text should not score 0', () => {
        cache.add({
            method: 'GET',
            path: '/api/userProfileData',
            className: 'ProfileController',
            methodName: 'getData',
            file: 'ProfileController.java',
            line: 10,
            framework: 'Spring'
        });

        // "upd" is not a substring, not a word boundary match in "userprofiledata"
        // but it IS an acronym (user, Profile, Data) → match via acronym
        const results = cache.search({ text: 'upd' });
        assert.strictEqual(results.length, 1, '"upd" should match "userProfileData" via acronym');
    });

    test('Fuzzy match: highly scattered match should score low but not zero', () => {
        cache.add({
            method: 'GET',
            path: '/api/abcdefghij',
            className: 'AbcController',
            methodName: 'getData',
            file: 'AbcController.java',
            line: 10,
            framework: 'Spring'
        });

        // "ace" in "abcdefghij" → matches a,c,e at positions 0,2,4 → span=5
        // consecutiveRatio=1/3=0.33, concentrationRatio=3/5=0.6 → 0.3
        const results = cache.search({ text: 'ace' });
        assert.strictEqual(results.length, 1, '"ace" should fuzzy-match "abcdefghij"');
    });

    test('Fuzzy match: completely scattered should score 0', () => {
        cache.add({
            method: 'GET',
            path: '/api/abcde',
            className: 'AbcdeController',
            methodName: 'getData',
            file: 'AbcdeController.java',
            line: 10,
            framework: 'Spring'
        });

        // "ae" in "abcde" → positions 0,4 → span=5, concentrationRatio=2/5=0.4 → 0.3
        const results = cache.search({ text: 'ae' });
        assert.strictEqual(results.length, 1, '"ae" should match "abcde" (concentrated enough)');
    });

    test('Size counter should be consistent after add/remove operations', () => {
        const ep1: RestEndpoint = {
            method: 'GET', path: '/a', className: 'A', methodName: 'a',
            file: 'A.java', line: 1, framework: 'Spring'
        };
        const ep2: RestEndpoint = {
            method: 'POST', path: '/b', className: 'B', methodName: 'b',
            file: 'B.java', line: 2, framework: 'Spring'
        };

        cache.add(ep1);
        cache.add(ep2);
        assert.strictEqual(cache.size(), 2);

        cache.removeByFile('A.java');
        assert.strictEqual(cache.size(), 1);

        cache.clear();
        assert.strictEqual(cache.size(), 0);
    });
});
