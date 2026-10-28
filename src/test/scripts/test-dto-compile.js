/**
 * JSON 生成代码合法性冒烟：字符串断言 + 可选的真实编译。
 *
 * - 字符串断言（始终执行）：关键字字段、重名字段、嵌套类与根类同名、空数组/可空
 *   类型按目标语言渲染，防止只检查"包含某个字符串"的脆弱契约回归。
 * - 真实编译（工具链存在时）：生成 Java 源码配合离线 JsonProperty 注解 stub 交给
 *   javac 编译，保证生成代码可被真实编译器接受；kotlinc 存在时同样编译 Kotlin。
 *   工具链缺失时报告 SKIP，结构断言仍然全部执行。
 *
 * 前置：npm run compile（或 npm test 的 pretest）
 * 运行：node src/test/scripts/test-dto-compile.js
 */

const { ensureFreshDist } = require('./lib/dist-check');
ensureFreshDist();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const projectRoot = path.resolve(__dirname, '../../..');
const { JsonClassGenerator } = require(path.join(projectRoot, 'dist/generator/JsonClassGenerator'));

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

function assertContains(source, needle, testName) {
    assert(
        source.includes(needle),
        testName,
        `期望包含 "${needle}"，实际输出:\n${source.split('\n').slice(0, 30).join('\n')}`
    );
}

function assertNotContains(source, needle, testName) {
    assert(
        !source.includes(needle),
        testName,
        `不应包含 "${needle}"，实际输出:\n${source.split('\n').slice(0, 30).join('\n')}`
    );
}

function assertContainsOnce(source, needle, testName) {
    const first = source.indexOf(needle);
    assert(
        first !== -1 && source.indexOf(needle, first + 1) === -1,
        testName,
        `期望恰好出现一次 "${needle}"，实际出现 ${source.split(needle).length - 1} 次`
    );
}

function commandExists(command) {
    return new Promise(resolve => {
        exec(`${command} -version`, error => resolve(!error));
    });
}

function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: os.tmpdir() }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(String(stderr || stdout || error.message).split('\n').slice(0, 12).join('\n')));
            } else {
                resolve();
            }
        });
    });
}

/** 离线 JsonProperty 注解 stub，使生成代码无需 Jackson 依赖即可通过 javac */
const JSON_PROPERTY_STUB = [
    'package com.fasterxml.jackson.annotation;',
    'import java.lang.annotation.ElementType;',
    'import java.lang.annotation.Retention;',
    'import java.lang.annotation.RetentionPolicy;',
    'import java.lang.annotation.Target;',
    '@Retention(RetentionPolicy.RUNTIME)',
    '@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER})',
    'public @interface JsonProperty {',
    '    String value() default "";',
    '}'
].join('\n');

const PACKAGE_NAME = 'com.example.generated';

const SAMPLES = [
    {
        name: '保留字与重名字段（L8）',
        json: '{"class":1,"a-b":1,"a_b":2}',
        className: 'Order',
        expect: {
            java(source) {
                assertNotContains(source, 'Long class;', 'Java 不输出保留字字段名 class');
                assertContains(source, '@JsonProperty("class")', 'Java 保留原始 JSON key 于注解');
                assertContainsOnce(source, 'private Long aB;', 'Java 重名 camelCase 字段只声明一次');
                assertContains(source, 'private Long aB2;', 'Java 冲突字段追加计数后缀');
            },
            kotlin(source) {
                assertNotContains(source, 'val class:', 'Kotlin 不输出硬关键字字段名 class');
                assertContains(source, 'val class2: Long', 'Kotlin 保留字字段追加计数后缀');
                assertContainsOnce(source, 'val aB: Long', 'Kotlin 重名字段只声明一次');
                assertContains(source, 'val aB2: Long', 'Kotlin 冲突字段追加计数后缀');
            }
        }
    },
    {
        name: '嵌套类不与根类同名',
        json: '{"user":{"name":"kit"}}',
        className: 'User',
        expect: {
            java(source) {
                assertContains(source, 'public class User {', '根类名保持 User');
                assertContains(source, 'public static class User2', '嵌套类名避开根类名');
            },
            kotlin(source) {
                assertContains(source, 'data class User2', 'Kotlin 嵌套类名避开根类名');
            }
        }
    },
    {
        name: '空数组与 null 的目标语言类型',
        json: '{"items":[],"remark":null}',
        className: 'Config',
        expect: {
            java(source) {
                assertContains(source, 'private List<Object> items;', 'Java 空数组输出 List<Object>');
                assertContains(source, 'private Object remark;', 'Java null 输出 Object');
            },
            kotlin(source) {
                assertContains(source, 'val items: List<Any?>', 'Kotlin 空数组输出 List<Any?>');
                assertContains(source, 'val remark: Any?', 'Kotlin null 输出可空类型');
            }
        }
    },
    {
        name: '嵌套对象数组',
        json: '{"orders":[{"id":1,"tags":["a"]}]}',
        className: 'Customer',
        expect: {
            java(source) {
                assertContains(source, 'private List<String> tags;', '数组元素类型按首元素推断');
                assertContains(source, 'private Long id;', '嵌套对象字段被展开');
            },
            kotlin(source) {
                assertContains(source, 'val tags: List<String>', 'Kotlin 数组元素类型按首元素推断');
                assertContains(source, 'val id: Long', 'Kotlin 嵌套对象字段被展开');
            }
        }
    },
    {
        name: '超过最大深度的嵌套退化为通配类型',
        json: '{"l1":{"l2":{"l3":{"l4":{"l5":1}}}}}',
        className: 'Deep',
        expect: {
            java(source) {
                assertContains(source, 'private Object l4;', 'Java 深层嵌套退化为 Object');
            },
            kotlin(source) {
                assertContains(source, 'val l4: Any', 'Kotlin 深层嵌套退化为 Any');
            }
        }
    }
];

async function main() {
    const generator = new JsonClassGenerator();
    const javaSources = [];
    const kotlinSources = [];

    for (const sample of SAMPLES) {
        console.log(`\n=== ${sample.name} ===`);
        const java = generator.generate(sample.json, sample.className, PACKAGE_NAME, 'java');
        javaSources.push({ className: sample.className, source: java });
        sample.expect.java(java);

        const kotlin = generator.generate(sample.json, sample.className, PACKAGE_NAME, 'kotlin');
        kotlinSources.push({ className: sample.className, source: kotlin });
        sample.expect.kotlin(kotlin);
    }

    const hasJavac = await commandExists('javac');
    const hasKotlinc = await commandExists('kotlinc');

    if (hasJavac) {
        console.log('\n=== javac 真实编译 ===');
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restful-toolkit-dto-java-'));
        try {
            fs.writeFileSync(path.join(workDir, 'JsonProperty.java'), JSON_PROPERTY_STUB, 'utf8');
            for (const entry of javaSources) {
                fs.writeFileSync(path.join(workDir, `${entry.className}.java`), entry.source, 'utf8');
            }
            const outDir = path.join(workDir, 'out');
            fs.mkdirSync(outDir);
            const fileArgs = fs.readdirSync(workDir)
                .filter(name => name.endsWith('.java'))
                .map(name => `"${path.join(workDir, name)}"`)
                .join(' ');
            await runCommand(`javac -encoding UTF-8 -d "${outDir}" ${fileArgs}`);
            assert(true, '生成的 Java 源码通过 javac 编译');
        } catch (error) {
            assert(false, '生成的 Java 源码通过 javac 编译', String(error.message || error));
        } finally {
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    } else {
        console.log('\n⏭️  未找到 javac，跳过 Java 真实编译（结构断言已全部执行）');
    }

    if (hasJavac && hasKotlinc) {
        console.log('\n=== kotlinc 真实编译 ===');
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restful-toolkit-dto-kotlin-'));
        try {
            const stubClasses = path.join(workDir, 'stub-classes');
            fs.mkdirSync(stubClasses);
            fs.writeFileSync(path.join(workDir, 'JsonProperty.java'), JSON_PROPERTY_STUB, 'utf8');
            await runCommand(`javac -d "${stubClasses}" "${path.join(workDir, 'JsonProperty.java')}"`);
            for (const entry of kotlinSources) {
                fs.writeFileSync(path.join(workDir, `${entry.className}.kt`), entry.source, 'utf8');
            }
            const outDir = path.join(workDir, 'out');
            fs.mkdirSync(outDir);
            const fileArgs = fs.readdirSync(workDir)
                .filter(name => name.endsWith('.kt'))
                .map(name => `"${path.join(workDir, name)}"`)
                .join(' ');
            await runCommand(`kotlinc -cp "${stubClasses}" -d "${outDir}" ${fileArgs}`);
            assert(true, '生成的 Kotlin 源码通过 kotlinc 编译');
        } catch (error) {
            assert(false, '生成的 Kotlin 源码通过 kotlinc 编译', String(error.message || error));
        } finally {
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    } else {
        console.log('\n⏭️  未找到 kotlinc（或 javac），跳过 Kotlin 真实编译（结构断言已全部执行）');
    }

    console.log(`\n📊 JSON 生成冒烟: 总计 ${totalTests}，通过 ${passed}，失败 ${failed}`);
    if (failed > 0) {
        console.log('\n❌ 失败明细:');
        for (const error of errors) {
            console.log(`   - ${error.test}: ${error.message}`);
        }
        process.exit(1);
    }
    console.log('✅ 所有 JSON 生成冒烟验证通过！');
}

main().catch(error => {
    console.error('❌ JSON 生成冒烟脚本异常:', error);
    process.exit(1);
});
