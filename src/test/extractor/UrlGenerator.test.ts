import * as assert from 'assert';
import { UrlGenerator } from '../../extractor/UrlGenerator';
import { EndpointCopyInfo } from '../../models/types';

suite('UrlGenerator Test Suite', () => {
    let generator: UrlGenerator;

    setup(() => {
        generator = new UrlGenerator();
    });

    function makeCopyInfo(overrides: Partial<EndpointCopyInfo>): EndpointCopyInfo {
        return {
            httpMethod: 'GET',
            contentType: 'url-params',
            path: '/api/users',
            parameters: [],
            framework: 'Spring',
            dtoFields: new Map(),
            ...overrides
        };
    }

    test('Should generate simple URL without query params', () => {
        const info = makeCopyInfo({ path: '/api/users' });
        const url = generator.generate(info, 'http://localhost:8080');
        assert.strictEqual(url, 'http://localhost:8080/api/users');
    });

    test('Should append query parameters', () => {
        const info = makeCopyInfo({
            path: '/api/users',
            parameters: [
                { name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: true },
                { name: 'page', type: 'int', source: 'query', originalCaseName: 'page', isRequired: false }
            ]
        });
        const url = generator.generate(info, 'http://localhost:8080');
        assert.strictEqual(url, 'http://localhost:8080/api/users?keyword=&page=');
    });

    test('Should preserve path parameter placeholders', () => {
        const info = makeCopyInfo({
            path: '/api/users/{userId}/posts/{postId}',
            parameters: [
                { name: 'sort', type: 'String', source: 'query', originalCaseName: 'sort', isRequired: false }
            ]
        });
        const url = generator.generate(info, 'http://localhost:8080');
        assert.strictEqual(url, 'http://localhost:8080/api/users/{userId}/posts/{postId}?sort=');
    });

    test('Should not add ? when no query params', () => {
        const info = makeCopyInfo({
            path: '/api/users/{id}',
            httpMethod: 'GET'
        });
        const url = generator.generate(info, 'http://localhost:8080');
        assert.strictEqual(url, 'http://localhost:8080/api/users/{id}');
    });

    test('Should use custom base URL', () => {
        const info = makeCopyInfo({ path: '/api/health' });
        const url = generator.generate(info, 'https://api.example.com:443');
        assert.strictEqual(url, 'https://api.example.com:443/api/health');
    });
});
