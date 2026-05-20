import * as assert from 'assert';
import { TextProcessor } from '../../utils/TextProcessor';

suite('TextProcessor Test Suite', () => {

    // ===== sanitize() =====

    test('Should replace double-quoted string with spaces', () => {
        const input = 'String s = "hello world";';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result, 'String s =              ;');
    });

    test('Should preserve newlines inside double-quoted strings', () => {
        const input = 'String s = "line1\nline2";';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result, 'String s =      \n      ;');
    });

    test('Should handle escaped quotes inside strings', () => {
        const input = 'String s = "say \\"hi\\"";';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result, 'String s =               ;');
    });

    test('Should replace single-quoted char with spaces', () => {
        const input = "char c = 'x';";
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result, 'char c =    ;');
    });

    test('Should replace single-line comments with spaces', () => {
        const input = '// this is a comment';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result, '                     ');
    });

    test('Should sanitize @annotation inside single-line comment', () => {
        const input = '// @GET fake annotation';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result.includes('@GET'), false, 'Sanitized comment should not contain @GET');
    });

    test('Should replace multi-line comments with spaces', () => {
        const input = '/* block\ncomment */';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result, '                 \n        ');
    });

    test('Should preserve newlines in multi-line comments', () => {
        const input = '/*\n * comment\n */';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result[0], ' ');
        assert.strictEqual(result[1], '\n');
        assert.strictEqual(result[3], '\n');
    });

    test('Should not affect code outside strings/comments', () => {
        const input = 'public @GET void foo() {}';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result, input);
    });

    test('Should handle string containing braces that could confuse brace matching', () => {
        const input = 'String s = "{ } ( )";';
        const result = TextProcessor.sanitize(input);
        assert.strictEqual(result.includes('{'), false, 'Braces inside strings should be sanitized');
        assert.strictEqual(result.includes('('), false, 'Parens inside strings should be sanitized');
    });

    test('Should handle annotation with string argument (parenthesis depth)', () => {
        const input = '@Path("/users/{id}")';
        const result = TextProcessor.sanitize(input);
        // @Path("...") should become @Path(        ) — parens remain, string content cleared
        assert.strictEqual(result.includes('/users'), false, 'Path content should be sanitized');
        assert.ok(result.startsWith('@Path('), '@Path( prefix preserved');
    });

    test('Index alignment: sanitized string should have same length as original', () => {
        const input = `@Path("/api")\npublic class Foo {\n    @GET\n    void bar() {}\n}`;
        const sanitized = TextProcessor.sanitize(input);
        assert.strictEqual(sanitized.length, input.length, 'Sanitized output must match original length');
    });

    // ===== buildLineIndex() + getLineNumber() =====

    test('buildLineIndex should collect all newline positions', () => {
        const input = 'a\nb\nc';
        const indices = TextProcessor.buildLineIndex(input);
        assert.deepStrictEqual(indices, [1, 3]);
    });

    test('buildLineIndex should return empty array for single-line input', () => {
        const input = 'no newlines here';
        const indices = TextProcessor.buildLineIndex(input);
        assert.deepStrictEqual(indices, []);
    });

    test('getLineNumber should return 1 for first line', () => {
        const indices = TextProcessor.buildLineIndex('line1\nline2\nline3');
        assert.strictEqual(TextProcessor.getLineNumber(indices, 0), 1);
        assert.strictEqual(TextProcessor.getLineNumber(indices, 4), 1);
    });

    test('getLineNumber should return correct line for middle positions', () => {
        const indices = TextProcessor.buildLineIndex('a\nbb\nccc\n');
        assert.strictEqual(TextProcessor.getLineNumber(indices, 2), 2);
        assert.strictEqual(TextProcessor.getLineNumber(indices, 3), 2);
        assert.strictEqual(TextProcessor.getLineNumber(indices, 6), 3);
    });

    test('getLineNumber should return correct line for last line', () => {
        const indices = TextProcessor.buildLineIndex('a\nb\nc');
        assert.strictEqual(TextProcessor.getLineNumber(indices, 4), 3);
        assert.strictEqual(TextProcessor.getLineNumber(indices, 10), 4); // past end counts as next line
    });

    test('getLineNumber on empty lineIndex should return 1', () => {
        assert.strictEqual(TextProcessor.getLineNumber([], 0), 1);
        assert.strictEqual(TextProcessor.getLineNumber([], 999), 1);
    });

    test('getLineNumberFallback should match naive line counting', () => {
        const input = 'line1\nline2\nline3\nline4';
        // Line 1
        assert.strictEqual(TextProcessor.getLineNumberFallback(input, 0), 1);
        assert.strictEqual(TextProcessor.getLineNumberFallback(input, 4), 1);
        // Line 2
        assert.strictEqual(TextProcessor.getLineNumberFallback(input, 6), 2);
        // Line 3
        assert.strictEqual(TextProcessor.getLineNumberFallback(input, 12), 3);
        // Line 4
        assert.strictEqual(TextProcessor.getLineNumberFallback(input, 18), 4);
    });

    test('getLineNumber via binary search should match fallback for all positions', () => {
        const input = 'aaa\nbb\ncccccc\nd\n';
        const indices = TextProcessor.buildLineIndex(input);
        for (let i = 0; i <= input.length; i++) {
            const binary = TextProcessor.getLineNumber(indices, i);
            const fallback = TextProcessor.getLineNumberFallback(input, i);
            assert.strictEqual(binary, fallback, `Mismatch at index ${i}: binary=${binary}, fallback=${fallback}`);
        }
    });

    // ===== Integration: sanitize + line number =====

    test('Sanitized text line numbers should match original', () => {
        const original = `@Path("/api")
public class UserController {
    @GET
    @Path("/users/{id}")
    public User getUser() { return null; }
}`;
        const sanitized = TextProcessor.sanitize(original);
        const lineIndex = TextProcessor.buildLineIndex(sanitized);

        // @GET is on line 3 in both original and sanitized
        const getIdx = sanitized.indexOf('@GET');
        assert.strictEqual(TextProcessor.getLineNumber(lineIndex, getIdx), 3);

        // @Path on line 4
        const pathIdx = sanitized.lastIndexOf('@Path');
        assert.strictEqual(TextProcessor.getLineNumber(lineIndex, pathIdx), 4);
    });
});
