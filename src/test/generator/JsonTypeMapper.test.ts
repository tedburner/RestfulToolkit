import * as assert from 'assert';
import { inferTypeFromValue, getImportStatements } from '../../generator/JsonTypeMapper';

suite('JsonTypeMapper Test Suite', () => {
    suite('inferTypeFromValue', () => {
        test('Should map string to String', () => {
            assert.strictEqual(inferTypeFromValue('hello', 'java'), 'String');
            assert.strictEqual(inferTypeFromValue('hello', 'kotlin'), 'String');
        });

        test('Should map integer to Long', () => {
            assert.strictEqual(inferTypeFromValue(42, 'java'), 'Long');
        });

        test('Should map float to Double', () => {
            assert.strictEqual(inferTypeFromValue(3.14, 'java'), 'Double');
        });

        test('Should map boolean to Boolean', () => {
            assert.strictEqual(inferTypeFromValue(true, 'java'), 'Boolean');
            assert.strictEqual(inferTypeFromValue(false, 'kotlin'), 'Boolean');
        });

        test('Should map null to Object (Java) or Any? (Kotlin)', () => {
            assert.strictEqual(inferTypeFromValue(null, 'java'), 'Object');
            assert.strictEqual(inferTypeFromValue(null, 'kotlin'), 'Any?');
        });

        test('Should map undefined to Object (Java) or Any? (Kotlin)', () => {
            assert.strictEqual(inferTypeFromValue(undefined, 'java'), 'Object');
            assert.strictEqual(inferTypeFromValue(undefined, 'kotlin'), 'Any?');
        });

        test('Should map empty array to List<Object>', () => {
            assert.strictEqual(inferTypeFromValue([], 'java'), 'List<Object>');
        });

        test('Should map array of strings to List<String>', () => {
            assert.strictEqual(inferTypeFromValue(['a', 'b'], 'java'), 'List<String>');
        });

        test('Should map array of numbers to List<Long>', () => {
            assert.strictEqual(inferTypeFromValue([1, 2, 3], 'java'), 'List<Long>');
        });

        test('Should map array of mixed types to first element type', () => {
            assert.strictEqual(inferTypeFromValue(['text', 123], 'java'), 'List<String>');
        });

        test('Should map object to Object', () => {
            assert.strictEqual(inferTypeFromValue({ name: 'test' }, 'java'), 'Object');
        });
    });

    suite('getImportStatements', () => {
        test('Should return Java imports with List', () => {
            const imports = getImportStatements('java');
            assert.ok(imports.includes('com.fasterxml.jackson.annotation.JsonProperty'));
            assert.ok(imports.includes('java.util.List'));
        });

        test('Should return Kotlin imports without List (implicit)', () => {
            const imports = getImportStatements('kotlin');
            assert.ok(imports.includes('com.fasterxml.jackson.annotation.JsonProperty'));
            assert.ok(!imports.includes('java.util.List'));
        });
    });
});
