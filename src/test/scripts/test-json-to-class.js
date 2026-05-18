/**
 * JSON 转 DTO 生成器批量测试脚本
 *
 * 用途：
 * - 验证 JsonTypeMapper 类型推断是否正确
 * - 验证 JsonClassGenerator Java 代码生成是否正确
 * - 验证 JsonClassGenerator Kotlin 代码生成是否正确
 * - 验证嵌套对象、数组、特殊字符处理
 * - 验证 NameTransformer toPascalCase
 *
 * 运行方法：从项目根目录运行
 *   node src/test/scripts/test-json-to-class.js
 */

const path = require('path');

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '../../..');
process.chdir(projectRoot);

// 加载模块
const { inferTypeFromValue, getImportStatements } = require(path.join(projectRoot, 'dist/generator/JsonTypeMapper'));
const { JsonClassGenerator } = require(path.join(projectRoot, 'dist/generator/JsonClassGenerator'));
const { toPascalCase } = require(path.join(projectRoot, 'dist/extractor/NameTransformer'));

let totalTests = 0;
let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, testName, message) {
    totalTests++;
    if (condition) {
        passed++;
        console.log(`  ✅ ${testName}`);
    } else {
        failed++;
        errors.push({ test: testName, message });
        console.log(`  ❌ ${testName} — ${message}`);
    }
}

console.log('=== JSON 转 DTO 生成器批量测试 ===\n');

// ===== 1. NameTransformer.toPascalCase =====
console.log('--- 1. toPascalCase ---');

{
    assert(toPascalCase('user_name') === 'UserName', 'snake_case → PascalCase', `期望 "UserName"，实际 "${toPascalCase('user_name')}"`);
}
{
    assert(toPascalCase('firstName') === 'FirstName', 'camelCase → PascalCase', `期望 "FirstName"，实际 "${toPascalCase('firstName')}"`);
}
{
    assert(toPascalCase('simple') === 'Simple', '单单词', `期望 "Simple"，实际 "${toPascalCase('simple')}"`);
}
{
    assert(toPascalCase('') === '', '空字符串', `期望 ""，实际 "${toPascalCase('')}"`);
}
{
    assert(toPascalCase('_leading') === 'Leading', '前导下划线', `期望 "Leading"，实际 "${toPascalCase('_leading')}"`);
}

// ===== 2. JsonTypeMapper 类型推断 =====
console.log('\n--- 2. 类型推断 ---');

{
    assert(inferTypeFromValue('hello', 'java') === 'String', 'string → String', '');
}
{
    assert(inferTypeFromValue(42, 'java') === 'Long', 'integer → Long', '');
}
{
    assert(inferTypeFromValue(3.14, 'java') === 'Double', 'float → Double', '');
}
{
    assert(inferTypeFromValue(true, 'java') === 'Boolean', 'boolean → Boolean', '');
}
{
    assert(inferTypeFromValue(null, 'java') === 'Object', 'null → Object (Java)', '');
}
{
    assert(inferTypeFromValue(null, 'kotlin') === 'Any?', 'null → Any? (Kotlin)', '');
}
{
    assert(inferTypeFromValue(undefined, 'java') === 'Object', 'undefined → Object (Java)', '');
}
{
    assert(inferTypeFromValue(['a', 'b'], 'java') === 'List<String>', 'array of strings → List<String>', '');
}
{
    assert(inferTypeFromValue([1, 2, 3], 'java') === 'List<Long>', 'array of ints → List<Long>', '');
}
{
    assert(inferTypeFromValue([], 'java') === 'List<Object>', 'empty array → List<Object>', '');
}
{
    const imports = getImportStatements('java');
    assert(imports.includes('com.fasterxml.jackson.annotation.JsonProperty'), 'Java imports 含 JsonProperty', '');
    assert(imports.includes('java.util.List'), 'Java imports 含 List', '');
}
{
    const imports = getImportStatements('kotlin');
    assert(imports.includes('com.fasterxml.jackson.annotation.JsonProperty'), 'Kotlin imports 含 JsonProperty', '');
}

// ===== 3. Java 代码生成 =====
console.log('\n--- 3. Java 代码生成 ---');

const generator = new JsonClassGenerator();

{
    // 简单单字段
    const json = JSON.stringify({ name: 'test' });
    const result = generator.generate(json, 'UserDto', 'com.example.dto', 'java');
    assert(result.includes('package com.example.dto;'), 'package 声明', '');
    assert(result.includes('public class UserDto'), '类声明', '');
    assert(result.includes('@JsonProperty("name")'), '@JsonProperty 注解', '');
    assert(result.includes('private String name;'), '字段声明', '');
    assert(result.includes('public String getName()'), 'getter', '');
    assert(result.includes('public void setName(String name)'), 'setter', '');
}
{
    // 多类型字段
    const json = JSON.stringify({ id: 123, name: 'test', active: true, score: 9.5 });
    const result = generator.generate(json, 'UserDto', 'com.example', 'java');
    assert(result.includes('private Long id;'), 'Long 类型', '');
    assert(result.includes('private String name;'), 'String 类型', '');
    assert(result.includes('private Boolean active;'), 'Boolean 类型', '');
    assert(result.includes('private Double score;'), 'Double 类型', '');
}
{
    // snake_case JSON key → camelCase field
    const json = JSON.stringify({ user_name: 'john', first_name: 'John' });
    const result = generator.generate(json, 'UserDto', 'com.example', 'java');
    assert(result.includes('@JsonProperty("user_name")'), '原始 key 保留', '');
    assert(result.includes('private String userName;'), 'camelCase 字段名', '');
    assert(result.includes('@JsonProperty("first_name")'), '多字段原始 key', '');
    assert(result.includes('private String firstName;'), '多字段 camelCase', '');
}
{
    // 数组类型
    const json = JSON.stringify({ tags: ['a', 'b'] });
    const result = generator.generate(json, 'PostDto', 'com.example', 'java');
    assert(result.includes('private List<String> tags;'), 'List<String>', '');
    assert(result.includes('import java.util.List;'), 'List import', '');
}
{
    // 空对象
    const json = JSON.stringify({});
    const result = generator.generate(json, 'EmptyDto', 'com.example', 'java');
    assert(result.includes('public class EmptyDto'), '空类声明', '');
    assert(!result.includes('private '), '无字段', '');
}

// ===== 4. Java 嵌套对象生成 =====
console.log('\n--- 4. Java 嵌套对象 ---');

{
    // 单层嵌套
    const json = JSON.stringify({ id: 1, user: { name: 'test', email: 't@e.com' } });
    const result = generator.generate(json, 'OrderDto', 'com.example', 'java');
    assert(result.includes('private User user;'), '嵌套字段类型', '');
    assert(result.includes('public static class User'), 'static 内部类', '');
    assert(result.includes('private String name;'), '内部类 String 字段', '');
    assert(result.includes('private String email;'), '内部类 email 字段', '');
}
{
    // 嵌套数组
    const json = JSON.stringify({
        id: 1,
        items: [{ id: 10, name: 'Book' }]
    });
    const result = generator.generate(json, 'OrderDto', 'com.example', 'java');
    assert(result.includes('private List<Items> items;'), 'List<嵌套类>', '');
    assert(result.includes('public static class Items'), '内部类 Items', '');
}
{
    // 深层嵌套 (3层)
    const json = JSON.stringify({
        l1: {
            l2: {
                l3: { value: 'deep' }
            }
        }
    });
    const result = generator.generate(json, 'DeepDto', 'com.example', 'java');
    assert(result.includes('private L1 l1;'), '第1层', '');
    assert(result.includes('private L2 l2;'), '第2层', '');
    assert(result.includes('private L3 l3;'), '第3层', '');
    assert(result.includes('private String value;'), '最深字段', '');
}

// ===== 5. Kotlin 代码生成 =====
console.log('\n--- 5. Kotlin 代码生成 ---');

{
    // 简单 data class
    const json = JSON.stringify({ name: 'test', age: 25 });
    const result = generator.generate(json, 'UserDto', 'com.example.dto', 'kotlin');
    assert(result.includes('package com.example.dto'), 'package 声明 (无分号)', '');
    assert(result.includes('data class UserDto('), 'data class 声明', '');
    assert(result.includes('@JsonProperty("name")'), '@JsonProperty', '');
    assert(result.includes('val name: String'), 'val 字段', '');
    assert(result.includes('val age: Long'), 'Long 字段', '');
}
{
    // Kotlin 嵌套
    const json = JSON.stringify({
        id: 1,
        address: { city: 'Beijing', zip: '100000' }
    });
    const result = generator.generate(json, 'UserDto', 'com.example', 'kotlin');
    assert(result.includes('val address: Address'), '嵌套字段类型', '');
    assert(result.includes('data class Address('), '嵌套 data class', '');
    assert(result.includes('val city: String'), '嵌套字段', '');
    assert(result.includes('val zip: String'), '嵌套 zip 字段', '');
}
{
    // Kotlin snake_case
    const json = JSON.stringify({ user_name: 'john' });
    const result = generator.generate(json, 'UserDto', 'com.example', 'kotlin');
    assert(result.includes('@JsonProperty("user_name")'), '原始 key 保留', '');
    assert(result.includes('val userName: String'), 'camelCase val', '');
}

// ===== 6. 真实场景：复杂 API 响应 =====
console.log('\n--- 6. 真实场景：复杂 API 响应 ---');

{
    const json = JSON.stringify({
        code: 200,
        message: "success",
        data: {
            user_id: 12345,
            user_name: "john_doe",
            email: "john@example.com",
            is_active: true,
            balance: 99.99,
            roles: ["admin", "user"],
            address: {
                street: "123 Main St",
                city: "Beijing",
                zip_code: "100000"
            },
            orders: [
                { order_id: 1, product_name: "Book", price: 29.99 }
            ]
        },
        timestamp: 1715000000000
    });
    const result = generator.generate(json, 'ApiResponseDto', 'com.example.api', 'java');

    assert(result.includes('public class ApiResponseDto'), '根类', '');
    assert(result.includes('private Long code;'), 'code 类型', '');
    assert(result.includes('private String message;'), 'message 类型', '');
    assert(result.includes('private Data data;'), 'data 嵌套类型', '');
    assert(result.includes('private Long timestamp;'), 'timestamp 类型', '');
    assert(result.includes('public static class Data'), 'Data 内部类', '');
    assert(result.includes('private Long userId;'), 'user_id → userId', '');
    assert(result.includes('@JsonProperty("user_id")'), 'user_id @JsonProperty', '');
    assert(result.includes('private String userName;'), 'user_name → userName', '');
    assert(result.includes('@JsonProperty("user_name")'), 'user_name @JsonProperty', '');
    assert(result.includes('private Boolean isActive;'), 'is_active → isActive', '');
    assert(result.includes('private Double balance;'), 'balance Double', '');
    assert(result.includes('private List<String> roles;'), 'roles List<String>', '');
    assert(result.includes('private Address address;'), 'address 嵌套', '');
    assert(result.includes('private List<Orders> orders;'), 'orders List<Orders>', '');
    assert(result.includes('public static class Address'), 'Address 内部类', '');
    assert(result.includes('private String zipCode;'), 'zip_code → zipCode', '');
    assert(result.includes('public static class Orders'), 'Orders 内部类', '');
    assert(result.includes('private Long orderId;'), 'order_id → orderId', '');
    assert(result.includes('private Double price;'), 'price Double', '');

    const ktResult = generator.generate(json, 'ApiResponseDto', 'com.example.api', 'kotlin');
    assert(ktResult.includes('data class ApiResponseDto('), 'Kotlin 根类', '');
    assert(ktResult.includes('val data: Data'), 'Kotlin data 字段', '');
    assert(ktResult.includes('data class Data('), 'Kotlin Data 类', '');
    assert(ktResult.includes('val userId: Long'), 'Kotlin userId', '');
    assert(ktResult.includes('val roles: List<String>'), 'Kotlin roles', '');
}

// ===== 7. 边界情况 =====
console.log('\n--- 7. 边界情况 ---');

{
    // 特殊字符 key
    const json = JSON.stringify({ "@type": "test", "123field": 456 });
    const result = generator.generate(json, 'SpecialDto', 'com.example', 'java');
    assert(result.includes('private String'), '特殊字符转义成功', '');
    assert(result.includes('private Long'), '数字开头 key 处理', '');
}
{
    // 无效 JSON
    let threw = false;
    try {
        generator.generate('{ broken }', 'Dto', 'com.example', 'java');
    } catch {
        threw = true;
    }
    assert(threw, '无效 JSON 抛出异常', '');
}
{
    // null value
    const json = JSON.stringify({ data: null });
    const result = generator.generate(json, 'NullDto', 'com.example', 'java');
    assert(result.includes('private Object data;'), 'null → Object', '');
}

// ===== 汇总 =====
console.log('\n=== 测试结果汇总 ===');
console.log(`📊 总测试数: ${totalTests}`);
console.log(`✅ 通过: ${passed} (${Math.round(passed / totalTests * 100)}%)`);
console.log(`❌ 失败: ${failed} (${Math.round(failed / totalTests * 100)}%)`);

if (errors.length > 0) {
    console.log('\n=== 失败详情 ===');
    errors.forEach((e, i) => {
        console.log(`  ${i + 1}. ${e.test}: ${e.message}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ 所有测试通过！');
}
