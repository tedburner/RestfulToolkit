import * as assert from 'assert';
import { CurlConverter } from '../../extractor/CurlConverter';
import { EndpointCopyInfo } from '../../models/types';

suite('CurlConverter Test Suite', () => {
    let converter: CurlConverter;

    setup(() => {
        converter = new CurlConverter();
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

    test('Should generate GET curl command', () => {
        const info = makeCopyInfo({
            httpMethod: 'GET',
            path: '/api/users',
            parameters: [
                { name: 'keyword', type: 'String', source: 'query', originalCaseName: 'keyword', isRequired: true }
            ]
        });
        const result = converter.generate(info, 'http://localhost:8080');
        assert.ok(result.includes("curl -X GET"));
        assert.ok(result.includes("http://localhost:8080/api/users?keyword="));
    });

    test('Should generate POST curl command with JSON body', () => {
        const info = makeCopyInfo({
            httpMethod: 'POST',
            contentType: 'json',
            path: '/api/users',
            parameters: [
                { name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
            ]
        });
        const result = converter.generate(info, 'http://localhost:8080');
        assert.ok(result.includes("curl -X POST"));
        assert.ok(result.includes("http://localhost:8080/api/users"));
        assert.ok(result.includes("-H 'Content-Type: application/json'"));
        assert.ok(result.includes('-d'));
    });

    test('Should include header parameters', () => {
        const info = makeCopyInfo({
            httpMethod: 'GET',
            path: '/api/users',
            parameters: [
                { name: 'X-Api-Key', type: 'String', source: 'header', originalCaseName: 'apiKey', isRequired: true }
            ]
        });
        const result = converter.generate(info, 'http://localhost:8080');
        assert.ok(result.includes("-H 'X-Api-Key: '"));
    });

    test('Should generate POST with form data content type', () => {
        const info = makeCopyInfo({
            httpMethod: 'POST',
            contentType: 'x-www-form-urlencoded',
            path: '/api/login',
            parameters: [
                { name: 'username', type: 'String', source: 'query', originalCaseName: 'username', isRequired: true },
                { name: 'password', type: 'String', source: 'query', originalCaseName: 'password', isRequired: true }
            ]
        });
        const result = converter.generate(info, 'http://localhost:8080');
        assert.ok(result.includes("Content-Type: application/x-www-form-urlencoded"));
    });

    test('Should use custom base URL', () => {
        const info = makeCopyInfo({
            httpMethod: 'GET',
            path: '/api/health'
        });
        const result = converter.generate(info, 'https://api.example.com:443');
        assert.ok(result.includes("https://api.example.com:443/api/health"));
    });
});
