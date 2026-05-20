import * as assert from 'assert';
import { JsonClassGenerator } from '../../generator/JsonClassGenerator';

suite('JsonClassGenerator Test Suite', () => {
    let generator: JsonClassGenerator;

    setup(() => {
        generator = new JsonClassGenerator();
    });

    suite('Simple JSON', () => {
        test('Should generate Java class with single string field', () => {
            const json = JSON.stringify({ name: 'test' });
            const result = generator.generate(json, 'UserDto', 'com.example', 'java');

            assert.ok(result.includes('package com.example;'));
            assert.ok(result.includes('public class UserDto'));
            assert.ok(result.includes('@JsonProperty("name")'));
            assert.ok(result.includes('private String name;'));
            assert.ok(result.includes('getName()'));
            assert.ok(result.includes('setName(String name)'));
        });

        test('Should generate Kotlin data class with single string field', () => {
            const json = JSON.stringify({ name: 'test' });
            const result = generator.generate(json, 'UserDto', 'com.example', 'kotlin');

            assert.ok(result.includes('package com.example'));
            assert.ok(result.includes('data class UserDto('));
            assert.ok(result.includes('@JsonProperty("name")'));
            assert.ok(result.includes('val name: String'));
        });
    });

    suite('Type mapping', () => {
        test('Should map integer to Long', () => {
            const json = JSON.stringify({ age: 25 });
            const result = generator.generate(json, 'UserDto', 'com.example', 'java');
            assert.ok(result.includes('private Long age;'));
        });

        test('Should map float to Double', () => {
            const json = JSON.stringify({ price: 9.99 });
            const result = generator.generate(json, 'ProductDto', 'com.example', 'java');
            assert.ok(result.includes('private Double price;'));
        });

        test('Should map boolean to Boolean', () => {
            const json = JSON.stringify({ active: true });
            const result = generator.generate(json, 'UserDto', 'com.example', 'java');
            assert.ok(result.includes('private Boolean active;'));
        });

        test('Should map null to Object', () => {
            const json = JSON.stringify({ data: null });
            const result = generator.generate(json, 'Dto', 'com.example', 'java');
            assert.ok(result.includes('private Object data;'));
        });
    });

    suite('Nested objects', () => {
        test('Should generate nested static class for Java', () => {
            const json = JSON.stringify({
                user: { name: 'test', age: 25 }
            });
            const result = generator.generate(json, 'OrderDto', 'com.example', 'java');

            assert.ok(result.includes('public static class User'));
            assert.ok(result.includes('private User user;'));
            assert.ok(result.includes('@JsonProperty("name")'));
            assert.ok(result.includes('@JsonProperty("age")'));
        });

        test('Should generate nested data class for Kotlin', () => {
            const json = JSON.stringify({
                user: { name: 'test', age: 25 }
            });
            const result = generator.generate(json, 'OrderDto', 'com.example', 'kotlin');

            assert.ok(result.includes('val user: User'));
            assert.ok(result.includes('data class User('));
        });
    });

    suite('Arrays', () => {
        test('Should generate List<T> for array of strings', () => {
            const json = JSON.stringify({ tags: ['java', 'kotlin'] });
            const result = generator.generate(json, 'PostDto', 'com.example', 'java');
            assert.ok(result.includes('private List<String> tags;'));
        });

        test('Should generate List with nested class for array of objects', () => {
            const json = JSON.stringify({
                items: [{ id: 1, name: 'item1' }]
            });
            const result = generator.generate(json, 'OrderDto', 'com.example', 'java');

            assert.ok(result.includes('private List<Items> items;'));
            assert.ok(result.includes('public static class Items'));
        });
    });

    suite('Snake case JSON keys', () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        test('Should convert snake_case key to camelCase field with @JsonProperty', () => {
            const json = JSON.stringify({ user_name: 'test', first_name: 'John' });
            const result = generator.generate(json, 'UserDto', 'com.example', 'java');

            assert.ok(result.includes('@JsonProperty("user_name")'));
            assert.ok(result.includes('private String userName;'));
            assert.ok(result.includes('@JsonProperty("first_name")'));
            assert.ok(result.includes('private String firstName;'));
        });
    });

    suite('Package and imports', () => {
        test('Should include correct package declaration', () => {
            const json = JSON.stringify({ name: 'test' });
            const result = generator.generate(json, 'Dto', 'com.example.dto', 'java');
            assert.ok(result.includes('package com.example.dto;'));
        });

        test('Should include Jackson import for Java', () => {
            const json = JSON.stringify({ name: 'test' });
            const result = generator.generate(json, 'Dto', 'com.example', 'java');
            assert.ok(result.includes('import com.fasterxml.jackson.annotation.JsonProperty'));
        });

        test('Should include Jackson import for Kotlin', () => {
            const json = JSON.stringify({ name: 'test' });
            const result = generator.generate(json, 'Dto', 'com.example', 'kotlin');
            assert.ok(result.includes('import com.fasterxml.jackson.annotation.JsonProperty'));
        });

        test('Should include java.util.List import for Java', () => {
            const json = JSON.stringify({ items: [1, 2, 3] });
            const result = generator.generate(json, 'Dto', 'com.example', 'java');
            assert.ok(result.includes('import java.util.List;'));
        });
    });

    suite('Error handling', () => {
        test('Should throw on invalid JSON', () => {
            assert.throws(() => {
                generator.generate('{ broken }', 'Dto', 'com.example', 'java');
            });
        });
    });

    suite('Empty objects', () => {
        test('Should generate empty class for empty object', () => {
            const json = JSON.stringify({});
            const result = generator.generate(json, 'EmptyDto', 'com.example', 'java');

            assert.ok(result.includes('public class EmptyDto'));
            assert.ok(!result.includes('private'));
        });
    });

    suite('Lombok mode', () => {
        test('Should generate @Data annotation on root class and skip getters/setters', () => {
            const json = JSON.stringify({ name: 'test' });
            const result = generator.generate(json, 'UserDto', 'com.example', 'java', true);

            assert.ok(result.includes('@Data'));
            assert.ok(result.includes('import lombok.Data;'));
            assert.ok(!result.includes('getName()'), 'Should not generate getter');
            assert.ok(!result.includes('setName(String name)'), 'Should not generate setter');
        });

        test('Should generate @Data on nested static classes without getters/setters', () => {
            const json = JSON.stringify({
                user: { name: 'test', age: 25 }
            });
            const result = generator.generate(json, 'OrderDto', 'com.example', 'java', true);

            const dataCount = (result.match(/@Data/g) || []).length;
            assert.strictEqual(dataCount, 2, 'Should have 2 @Data annotations (root + nested)');
            assert.ok(!result.includes('getAge()'), 'Should not generate getter in nested class');
        });

        test('Should not generate @Data when useLombok is false', () => {
            const json = JSON.stringify({ name: 'test' });
            const result = generator.generate(json, 'UserDto', 'com.example', 'java', false);

            assert.ok(!result.includes('@Data'), 'Should not contain @Data');
            assert.ok(!result.includes('import lombok.Data;'), 'Should not import lombok.Data');
            assert.ok(result.includes('getName()'));
            assert.ok(result.includes('setName(String name)'));
        });

        test('Should generate getters/setters in nested classes when useLombok is false', () => {
            const json = JSON.stringify({
                user: { name: 'test', age: 25 }
            });
            const result = generator.generate(json, 'OrderDto', 'com.example', 'java', false);

            assert.ok(result.includes('getAge()'), 'Should generate getter in nested class');
            assert.ok(result.includes('setAge(Long age)'), 'Should generate setter in nested class');
            assert.ok(!result.includes('@Data'));
        });

        test('Default behavior (no 5th arg) should not use Lombok', () => {
            const json = JSON.stringify({ name: 'test' });
            const result = generator.generate(json, 'UserDto', 'com.example', 'java');

            assert.ok(!result.includes('@Data'));
            assert.ok(result.includes('getName()'));
        });
    });
});
