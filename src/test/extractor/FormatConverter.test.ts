import * as assert from 'assert';
import { FormatConverter } from '../../extractor/FormatConverter';
import { EndpointCopyInfo, EndpointParameter, DtoField } from '../../models/types';

suite('FormatConverter Test Suite', () => {
    let converter: FormatConverter;

    setup(() => {
        converter = new FormatConverter();
    });

    const makeInfo = (params: EndpointParameter[], dtoFields: Map<string, DtoField[]> = new Map()): EndpointCopyInfo => ({
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/test',
        parameters: params,
        framework: 'Spring',
        dtoFields
    });

    test('Should convert to URL params', () => {
        const info = makeInfo([
            { name: 'id', type: 'Long', source: 'path', originalCaseName: 'id', isRequired: true },
            { name: 'name', type: 'String', source: 'query', originalCaseName: 'name', isRequired: true }
        ]);
        const result = converter.toUrlParams(info);
        assert.strictEqual(result, '?id=&name=');
    });

    test('Should convert to JSON quick format', () => {
        const info = makeInfo([
            { name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
        ]);
        const result = converter.toJsonQuick(info);
        assert.strictEqual(result, '{"userDto": ""}');
    });

    test('Should convert to form-data format', () => {
        const info = makeInfo([
            { name: 'file', type: 'MultipartFile', source: 'form', originalCaseName: 'file', isRequired: true },
            { name: 'desc', type: 'String', source: 'form', originalCaseName: 'desc', isRequired: true }
        ]);
        const result = converter.toFormData(info);
        assert.strictEqual(result, 'file: \ndesc: ');
    });

    test('Should convert to x-www-form-urlencoded', () => {
        const info = makeInfo([
            { name: 'username', type: 'String', source: 'query', originalCaseName: 'username', isRequired: true },
            { name: 'password', type: 'String', source: 'query', originalCaseName: 'password', isRequired: true }
        ]);
        const result = converter.toFormUrlencoded(info);
        assert.strictEqual(result, 'username=&password=');
    });

    test('Should handle empty parameters', () => {
        const info = makeInfo([]);
        assert.strictEqual(converter.toUrlParams(info), '');
        assert.strictEqual(converter.toJsonQuick(info), '{}');
        assert.strictEqual(converter.toFormData(info), '');
        assert.strictEqual(converter.toFormUrlencoded(info), '');
    });

    test('Should apply name transformation via format function', () => {
        const info = makeInfo([
            { name: 'userName', type: 'String', source: 'query', originalCaseName: 'userName', isRequired: true }
        ]);
        const result = converter.toUrlParams(info, (n) => n.replace(/([A-Z])/g, '_$1').toLowerCase());
        assert.strictEqual(result, '?user_name=');
    });

    test('Should expand DTO fields in toJsonBody when available', () => {
        const dtoFields = new Map<string, DtoField[]>();
        dtoFields.set('UserDto', [
            { name: 'id', type: 'Long', originalName: 'id' },
            { name: 'userName', type: 'String', originalName: 'userName' },
            { name: 'emailAddr', type: 'String', originalName: 'emailAddr' }
        ]);
        const info = makeInfo([
            { name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
        ], dtoFields);
        const result = converter.toJsonBody(info);
        assert.strictEqual(result, '{"id": "", "userName": "", "emailAddr": ""}');
    });

    test('Should fall back to quick format in toJsonBody when DTO not found', () => {
        const info = makeInfo([
            { name: 'userDto', type: 'UnknownDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
        ]);
        const result = converter.toJsonBody(info);
        assert.strictEqual(result, '{"userDto": ""}');
    });

    test('Should apply snake_case transformation to DTO fields', () => {
        const dtoFields = new Map<string, DtoField[]>();
        dtoFields.set('UserDto', [
            { name: 'id', type: 'Long', originalName: 'id' },
            { name: 'userName', type: 'String', originalName: 'userName' },
            { name: 'emailAddr', type: 'String', originalName: 'emailAddr' }
        ]);
        const info = makeInfo([
            { name: 'userDto', type: 'UserDto', source: 'body', originalCaseName: 'userDto', isRequired: true }
        ], dtoFields);
        const result = converter.toJsonBody(info, (n) => n.replace(/([A-Z])/g, '_$1').toLowerCase());
        assert.strictEqual(result, '{"id": "", "user_name": "", "email_addr": ""}');
    });

    test('Should fall back to quick format for non-body parameters', () => {
        const info = makeInfo([
            { name: 'id', type: 'Long', source: 'path', originalCaseName: 'id', isRequired: true },
            { name: 'name', type: 'String', source: 'query', originalCaseName: 'name', isRequired: true }
        ]);
        const result = converter.toJsonBody(info);
        assert.strictEqual(result, '{"id": "", "name": ""}');
    });

    test('Should fall back to quick format when body param is primitive type', () => {
        const info = makeInfo([
            { name: 'id', type: 'Long', source: 'body', originalCaseName: 'id', isRequired: true }
        ]);
        const result = converter.toJsonBody(info);
        assert.strictEqual(result, '{"id": ""}');
    });
});
