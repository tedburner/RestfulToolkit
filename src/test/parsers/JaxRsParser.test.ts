import * as assert from 'assert';
import { JaxRsParser } from '../../parsers/JaxRsParser';

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
        const classPath = parser.parseClassLevelPath(content, 'UserController');
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
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
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
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
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
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
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
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
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
        const classPath = parser.parseClassLevelPath(content, 'UserController');
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', classPath, 'test.java');
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
        const classPath = parser.parseClassLevelPath(content, 'UserController');
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', classPath, 'test.java');
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
        const endpoints = parser.parseMethodAnnotations(content, 'UserController', null, 'test.java');
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/users/{id}');
    });
});