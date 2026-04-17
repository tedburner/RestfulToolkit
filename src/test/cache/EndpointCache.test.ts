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
});