import * as assert from 'assert';
import { toSnakeCase, toCamelCase } from '../../extractor/NameTransformer';

suite('NameTransformer Test Suite', () => {
    suite('toSnakeCase', () => {
        test('Should convert camelCase to snake_case', () => {
            assert.strictEqual(toSnakeCase('userName'), 'user_name');
        });

        test('Should convert simple camelCase', () => {
            assert.strictEqual(toSnakeCase('firstName'), 'first_name');
        });

        test('Should handle single word', () => {
            assert.strictEqual(toSnakeCase('user'), 'user');
        });

        test('Should handle already snake_case', () => {
            assert.strictEqual(toSnakeCase('user_name'), 'user_name');
        });

        test('Should handle multiple consecutive uppercase (e.g. DTO)', () => {
            assert.strictEqual(toSnakeCase('userDTO'), 'user_d_t_o');
        });

        test('Should handle empty string', () => {
            assert.strictEqual(toSnakeCase(''), '');
        });
    });

    suite('toCamelCase', () => {
        test('Should convert snake_case to camelCase', () => {
            assert.strictEqual(toCamelCase('user_name'), 'userName');
        });

        test('Should convert multiple underscores', () => {
            assert.strictEqual(toCamelCase('first_middle_name'), 'firstMiddleName');
        });

        test('Should handle single word', () => {
            assert.strictEqual(toCamelCase('user'), 'user');
        });

        test('Should handle already camelCase', () => {
            assert.strictEqual(toCamelCase('userName'), 'userName');
        });

        test('Should handle leading underscore', () => {
            assert.strictEqual(toCamelCase('_user_name'), 'userName');
        });

        test('Should handle empty string', () => {
            assert.strictEqual(toCamelCase(''), '');
        });
    });
});
