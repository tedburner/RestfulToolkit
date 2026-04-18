import * as assert from 'assert';
import { SpringMvcParser } from '../../parsers/SpringMvcParser';

suite('SpringMvcParser Test Suite', () => {
    let parser: SpringMvcParser;

    setup(() => {
        parser = new SpringMvcParser();
    });

    test('Should parse class-level @RequestMapping', () => {
        const content = `
            @RequestMapping("/api")
            public class UserController {
                @GetMapping("/users")
                public List<User> getUsers() {}
            }
        `;
        const classPath = parser.parseClassLevelPath(content, 'UserController');
        assert.strictEqual(classPath, '/api');
    });

    test('Should parse @GetMapping', () => {
        const content = `
            public class UserController {
                @GetMapping("/users")
                public List<User> getUsers() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'GET');
        assert.strictEqual(endpoints[0].path, '/users');
        assert.strictEqual(endpoints[0].className, 'UserController');
        assert.strictEqual(endpoints[0].methodName, 'getUsers');
    });

    test('Should parse @PostMapping with value attribute', () => {
        const content = `
            public class UserController {
                @PostMapping(value = "/create")
                public User createUser() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'POST');
        assert.strictEqual(endpoints[0].path, '/create');
    });

    test('Should parse @RequestMapping with method parameter', () => {
        const content = `
            public class UserController {
                @RequestMapping(path = "/list", method = RequestMethod.GET)
                public List<User> listUsers() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'GET');
        assert.strictEqual(endpoints[0].path, '/list');
    });

    test('Should combine class-level and method-level paths', () => {
        const content = `
            @RequestMapping("/api")
            public class UserController {
                @GetMapping("/users")
                public List<User> getUsers() {}
            }
        `;
        const classPath = parser.parseClassLevelPath(content, 'UserController');
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', classPath, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/api/users');
    });

    test('Should parse multi-path annotation', () => {
        const content = `
            public class UserController {
                @GetMapping({"/users", "/list"})
                public List<User> getUsers() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 2);
        assert.strictEqual(endpoints[0].path, '/users');
        assert.strictEqual(endpoints[1].path, '/list');
    });

    test('Should parse @PutMapping', () => {
        const content = `
            public class UserController {
                @PutMapping("/update")
                public User updateUser() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'PUT');
        assert.strictEqual(endpoints[0].path, '/update');
    });

    test('Should parse @DeleteMapping', () => {
        const content = `
            public class UserController {
                @DeleteMapping("/delete")
                public void deleteUser() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'DELETE');
        assert.strictEqual(endpoints[0].path, '/delete');
    });

    test('Should parse @PatchMapping', () => {
        const content = `
            public class UserController {
                @PatchMapping("/patch")
                public User patchUser() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'PATCH');
        assert.strictEqual(endpoints[0].path, '/patch');
    });

    test('Should handle annotation parameter order variations', () => {
        const content = `
            public class UserController {
                @RequestMapping(method = RequestMethod.POST, path = "/create")
                public User createUser() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'POST');
        assert.strictEqual(endpoints[0].path, '/create');
    });

    test('Should handle path variables in paths', () => {
        const content = `
            public class UserController {
                @GetMapping("/users/{id}")
                public User getUserById() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/users/{id}');
});
    test('Should combine class-level and method-level @RequestMapping', () => {
        const content = `
            @RestController
            @RequestMapping("/document/rag")
            public class DocumentRagController {
                @PostMapping("/v1/parse")
                public WebResult uploadParse() {}
                
                @RequestMapping("/v1/test")
                public WebResult test() {}
            }
        `;
        const classPath = parser.parseClassLevelPath(content, 'DocumentRagController');
        assert.strictEqual(classPath, '/document/rag');
        
        const endpoints = parser.parseMethodAnnotations(content, 'DocumentRagController', classPath, 'test.java');
        assert.strictEqual(endpoints.length, 2);
        
        // 检查第一个端点: @PostMapping + class-level
        assert.strictEqual(endpoints[0].method, 'POST');
        assert.strictEqual(endpoints[0].path, '/document/rag/v1/parse');
        assert.strictEqual(endpoints[0].methodName, 'uploadParse');
        
        // 检查第二个端点: @RequestMapping (简写) + class-level
        assert.strictEqual(endpoints[1].method, 'GET');
        assert.strictEqual(endpoints[1].path, '/document/rag/v1/test');
        assert.strictEqual(endpoints[1].methodName, 'test');
    });

    test('Should parse method-level @RequestMapping with shorthand path', () => {
        const content = `
            public class SimpleController {
                @RequestMapping("/simple")
                public void simpleMethod() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'SimpleController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'GET');
        assert.strictEqual(endpoints[0].path, '/simple');
    });

    test('Should parse method-level @RequestMapping with explicit value', () => {
        const content = `
            public class ValueController {
                @RequestMapping(value = "/explicit")
                public void explicitMethod() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'ValueController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].method, 'GET');
        assert.strictEqual(endpoints[0].path, '/explicit');
    });

    test('Should parse method-level @RequestMapping with method parameter', () => {
        const content = `
            public class MethodController {
                @RequestMapping(value = "/post", method = RequestMethod.POST)
                public void postMethod() {}
                
                @RequestMapping(path = "/put", method = RequestMethod.PUT)
                public void putMethod() {}
            }
        `;
        const endpoints = parser.parseMethodAnnotations(content, 'MethodController', null, 'test.java');
        assert.strictEqual(endpoints.length, 2);
        
        assert.strictEqual(endpoints[0].method, 'POST');
        assert.strictEqual(endpoints[0].path, '/post');
        
        assert.strictEqual(endpoints[1].method, 'PUT');
        assert.strictEqual(endpoints[1].path, '/put');
    });
});
