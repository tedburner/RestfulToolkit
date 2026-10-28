import * as assert from 'assert';
import { JaxRsParser } from '../../parsers/JaxRsParser';
import { TextProcessor } from '../../utils/TextProcessor';

suite('JaxRsParser Test Suite', () => {
    let parser: JaxRsParser;

    setup(() => {
        parser = new JaxRsParser();
    });

    test('Should parse class-level @Path', () => {
        const content = `
            @Path("/api")
            public class UserController {
                @GET
                @Path("/users")
                public List<User> getUsers() {}
            }
        `;
        const classPath = parser.parseClassLevelPath(content);
        assert.strictEqual(classPath, '/api');
    });

    test('Should parse @GET annotation', () => {
        const content = `
            public class UserController {
                @GET
                @Path("/users")
                public List<User> getUsers() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'GET');
        assert.strictEqual(endpoints[0].path, '/users');
        assert.strictEqual(endpoints[0].framework, 'JAX-RS');
    });

    test('Should parse @POST annotation', () => {
        const content = `
            public class UserController {
                @POST
                @Path("/create")
                public User createUser() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'POST');
        assert.strictEqual(endpoints[0].path, '/create');
    });

    test('Should parse @PUT annotation', () => {
        const content = `
            public class UserController {
                @PUT
                @Path("/update")
                public User updateUser() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'PUT');
        assert.strictEqual(endpoints[0].path, '/update');
    });

    test('Should parse @DELETE annotation', () => {
        const content = `
            public class UserController {
                @DELETE
                @Path("/delete")
                public void deleteUser() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'DELETE');
        assert.strictEqual(endpoints[0].path, '/delete');
    });

    test('Should combine class-level and method-level paths', () => {
        const content = `
            @Path("/api")
            public class UserController {
                @GET
                @Path("/users")
                public List<User> getUsers() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', classPath, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/api/users');
    });

    test('Should handle method without @Path (use class path only)', () => {
        const content = `
            @Path("/api")
            public class UserController {
                @GET
                public List<User> getAllUsers() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', classPath, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/api');
    });

    test('Should handle path variables', () => {
        const content = `
            public class UserController {
                @GET
                @Path("/users/{id}")
                public User getUserById() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/users/{id}');
    });

    test('Should use correct position when HTTP method appears multiple times', () => {
        // @GET 出现在注释中和实际注解中，应匹配实际注解的位置
        const content = `
            public class UserController {
                // This endpoint handles @GET requests
                // but actually the method is: @GET
                @GET
                @Path("/real")
                public List<User> getUsers() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/real');
    });

    test('Should use lineIndex for correct line number calculation', () => {
        const content = `
            public class UserController {
                @GET
                @Path("/line1")
                public User method1() {}

                @POST
                @Path("/line2")
                public User method2() {}

                @DELETE
                @Path("/line3")
                public void method3() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const lineIndex = TextProcessor.buildLineIndex(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java', lineIndex);

        assert.strictEqual(endpoints.length, 3);

        // Verify line numbers via lineIndex are correct (1-based)
        const line1Idx = content.indexOf('@GET');
        const expectedLine1 = TextProcessor.getLineNumberFallback(content, line1Idx);
        assert.strictEqual(endpoints[0].line, expectedLine1, `@GET 应在第 ${expectedLine1} 行`);

        const line2Idx = content.indexOf('@POST');
        const expectedLine2 = TextProcessor.getLineNumberFallback(content, line2Idx);
        assert.strictEqual(endpoints[1].line, expectedLine2, `@POST 应在第 ${expectedLine2} 行`);

        const line3Idx = content.indexOf('@DELETE');
        const expectedLine3 = TextProcessor.getLineNumberFallback(content, line3Idx);
        assert.strictEqual(endpoints[2].line, expectedLine3, `@DELETE 应在第 ${expectedLine3} 行`);
    });

    test('Should keep exact line numbers for identical annotation blocks', () => {
        const content = `public class UserController {
    @GET
    @Path("/same")
    public User first() {}

    @GET
    @Path("/same")
    public User second() {}
}`;
        const sanitized = TextProcessor.sanitize(content);
        const lineIndex = TextProcessor.buildLineIndex(content);
        const endpoints = parser.parseMethodAnnotations(
            content,
            sanitized,
            'UserController',
            null,
            'test.java',
            lineIndex
        );

        assert.strictEqual(endpoints.length, 2);
        assert.strictEqual(
            endpoints[0].line,
            TextProcessor.getLineNumberFallback(content, content.indexOf('@GET'))
        );
        assert.strictEqual(
            endpoints[1].line,
            TextProcessor.getLineNumberFallback(content, content.lastIndexOf('@GET'))
        );
    });

    test('Should keep exact line numbers when CRLF annotations place @Path before @GET', () => {
        const content = [
            'public class UserController {',
            '@Path("/first")',
            '@Produces("application/json")',
            '@GET',
            'public User first() {}',
            '',
            '@Path("/second")',
            '@Produces("application/json")',
            '@GET',
            'public User second() {}',
            '}'
        ].join('\r\n');
        const sanitized = TextProcessor.sanitize(content);
        const lineIndex = TextProcessor.buildLineIndex(content);
        const endpoints = parser.parseMethodAnnotations(
            content,
            sanitized,
            'UserController',
            null,
            'test.java',
            lineIndex
        );

        assert.strictEqual(endpoints.length, 2);
        const firstGet = content.indexOf('@GET');
        const secondGet = content.lastIndexOf('@GET');
        assert.strictEqual(endpoints[0].line, TextProcessor.getLineNumberFallback(content, firstGet));
        assert.strictEqual(endpoints[1].line, TextProcessor.getLineNumberFallback(content, secondGet));
    });

    test('Should correctly handle JAX-RS endpoint with annotations in comments', () => {
        // @GET 出现在注释中，应通过 sanitize 清除注释后再匹配
        const content = `
            public class UserController {
                // @GET 这是注释，不应被匹配
                // 另一个假的 @GET
                @GET
                @Path("/real")
                public User realMethod() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/real');
    });

    test('Should ignore method signatures inside comments', () => {
        const content = `
            public class UserController {
                /*
                 * Example: public User findById(int id) {
                 */
                @GET
                @Path("/{id}")
                public User getUser(@PathParam("id") int id) {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].methodName, 'getUser');
        assert.strictEqual(endpoints[0].path, '/{id}');
    });

    test('Should handle @Path with braces in string that could confuse matching', () => {
        const content = `
            public class UserController {
                @GET
                @Path("/users/{userId}/orders/{orderId}")
                public Order getOrder() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/users/{userId}/orders/{orderId}');
    });

    test('Should parse fully qualified JAX-RS annotations', () => {
        const content = `
            @jakarta.ws.rs.Path("/api")
            public class UserController {
                @jakarta.ws.rs.GET
                @jakarta.ws.rs.Path("/users")
                public List<User> getUsers() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'UserController', classPath, 'test.java');
        assert.strictEqual(classPath, '/api');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/api/users');
    });

    test('does not treat method-body invocations as endpoints', () => {
        const content = `
            @Path("/api")
            class Api {
                @GET
                @Path("/a")
                public String a() {
                    return service();
                }
                @POST
                @Path("/b")
                public String b() {
                    return "ok";
                }
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.java');

        assert.deepStrictEqual(
            endpoints.map(endpoint => `${endpoint.methodName} ${endpoint.path}`),
            ['a /api/a', 'b /api/b']
        );
    });

    test('parses interface methods without a body', () => {
        const content = `
            public interface Api {
                @GET
                @Path("/x")
                String a();
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].methodName, 'a');
        assert.strictEqual(endpoints[0].path, '/x');
    });

    test('parses multi-line @Path annotations', () => {
        const content = `
            public class Api {
                @GET
                @Path(
                    "/multi"
                )
                public String a() { return "ok"; }
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/multi');
    });

    test('scans each method body only once without rescanning statements', () => {
        const content = `
            public class Api {
                @GET
                @Path("/a")
                public String a() { return helperOne(); }

                @POST
                @Path("/b")
                public String b() { return helperTwo(); }
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', null, 'test.java');
        assert.strictEqual(endpoints.length, 2);
        assert.ok(endpoints.every(endpoint => !endpoint.methodName.startsWith('helper')));
    });

    test('parses Kotlin methods with explicit return types', () => {
        const content = `
            @Path("/api")
            class Api {
                @GET
                @Path("/a")
                fun a(): String {
                    return "ok"
                }

                @POST
                @Path("/b")
                fun b() {
                }
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.kt');

        assert.deepStrictEqual(
            endpoints.map(endpoint => `${endpoint.method} ${endpoint.path} ${endpoint.methodName}`),
            ['GET /api/a a', 'POST /api/b b']
        );
    });

    test('parses Kotlin methods with nullable return types', () => {
        const content = `
            @Path("/api")
            class Api {
                @GET
                @Path("/n")
                fun n(): String? {
                    return null
                }
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.kt');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'GET');
        assert.strictEqual(endpoints[0].path, '/api/n');
        assert.strictEqual(endpoints[0].methodName, 'n');
    });

    test('parses generic methods in Java and Kotlin', () => {
        const content = `
            @Path("/api")
            class Api {
                @GET
                @Path("/j")
                public <T> Response j() { return null; }

                @POST
                @Path("/k")
                fun <T> k(item: T): T {
                    return item
                }
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.java');

        assert.deepStrictEqual(
            endpoints.map(endpoint => `${endpoint.method} ${endpoint.path} ${endpoint.methodName}`),
            ['GET /api/j j', 'POST /api/k k']
        );
    });

    test('does not leak annotations from skipped expression-body methods to the next method', () => {
        const content = `
            @Path("/api")
            class Api {
                @GET
                @Path("/e")
                fun e() = service()

                @PUT
                @Path("/f")
                fun f() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.kt');

        // 表达式函数体 e 不产生端点（已知限制），且其注解不得泄漏给 f 生成幻影 GET /api/f
        assert.deepStrictEqual(
            endpoints.map(endpoint => `${endpoint.method} ${endpoint.path} ${endpoint.methodName}`),
            ['PUT /api/f f']
        );
    });

    test('does not leak annotations from skipped nullable expression-body methods', () => {
        const content = `
            @Path("/api")
            class Api {
                @GET
                @Path("/n")
                fun n(): String? = null

                @POST
                @Path("/b")
                fun b() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.kt');

        assert.deepStrictEqual(
            endpoints.map(endpoint => `${endpoint.method} ${endpoint.path} ${endpoint.methodName}`),
            ['POST /api/b b']
        );
    });

    test('does not leak annotations from Kotlin properties to the next method', () => {
        const content = `
            @Path("/api")
            class Api {
                @GET
                @JvmField
                val helper = 1

                fun notEndpoint() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.kt');

        // 携带 HTTP 动词的字段不是端点，其注解不得泄漏给后续函数生成幻影 GET /api/notEndpoint
        assert.deepStrictEqual(endpoints, []);
    });

    test('does not leak annotations from Java constants to the next interface method', () => {
        const content = `
            @Path("/api")
            public interface Api {
                @GET
                String VERSION = "v1";

                @POST
                @Path("/create")
                void create();
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.java');

        assert.deepStrictEqual(
            endpoints.map(endpoint => `${endpoint.method} ${endpoint.path} ${endpoint.methodName}`),
            ['POST /api/create create']
        );
    });

    test('still parses a real endpoint that follows an annotated non-method member', () => {
        const content = `
            @Path("/api")
            class Api {
                @GET
                @JvmField
                val helper = 1

                @POST
                @Path("/real")
                fun real() {}
            }
        `;
        const sanitized = TextProcessor.sanitize(content);
        const classPath = parser.parseClassLevelPath(content);
        const endpoints = parser.parseMethodAnnotations(content, sanitized, 'Api', classPath, 'test.kt');

        // 重置注解收集起点后，后续真实端点自己的注解仍然完整可用
        assert.deepStrictEqual(
            endpoints.map(endpoint => `${endpoint.method} ${endpoint.path} ${endpoint.methodName}`),
            ['POST /api/real real']
        );
    });
});
