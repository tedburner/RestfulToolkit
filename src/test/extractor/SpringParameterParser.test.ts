import * as assert from 'assert';
import { SpringParameterParser } from '../../extractor/SpringParameterParser';

suite('SpringParameterParser Test Suite', () => {
    let parser: SpringParameterParser;

    setup(() => {
        parser = new SpringParameterParser();
    });

    test('Should parse bare @RequestParam', () => {
        const params = parser.parseMethodParameters(
            'public String search(@RequestParam String keyword) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'keyword');
        assert.strictEqual(params[0].source, 'query');
        assert.strictEqual(params[0].type, 'String');
        assert.strictEqual(params[0].isRequired, true);
    });

    test('Should parse @RequestParam with explicit name', () => {
        const params = parser.parseMethodParameters(
            'public String search(@RequestParam("user_name") String userName) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'user_name');
        assert.strictEqual(params[0].originalCaseName, 'userName');
    });

    test('Should parse @RequestParam with value attribute', () => {
        const params = parser.parseMethodParameters(
            'public String search(@RequestParam(value = "page", defaultValue = "1") int page) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'page');
        assert.strictEqual(params[0].defaultValue, '1');
    });

    test('Should parse bare @PathVariable', () => {
        const params = parser.parseMethodParameters(
            'public String get(@PathVariable Long id) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'id');
        assert.strictEqual(params[0].source, 'path');
    });

    test('Should parse @PathVariable with explicit name', () => {
        const params = parser.parseMethodParameters(
            'public String get(@PathVariable("user_id") Long userId) {}'
        );
        assert.strictEqual(params[0].name, 'user_id');
        assert.strictEqual(params[0].originalCaseName, 'userId');
    });

    test('Should parse @RequestBody', () => {
        const params = parser.parseMethodParameters(
            'public String create(@RequestBody UserDto userDto) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'userDto');
        assert.strictEqual(params[0].source, 'body');
        assert.strictEqual(params[0].type, 'UserDto');
    });

    test('Should parse multiple parameters', () => {
        const params = parser.parseMethodParameters(
            'public String update(@PathVariable Long id, @RequestParam String name, @RequestBody UserDto user) {}'
        );
        assert.strictEqual(params.length, 3);
        assert.strictEqual(params[0].source, 'path');
        assert.strictEqual(params[1].source, 'query');
        assert.strictEqual(params[2].source, 'body');
    });

    test('Should parse @RequestPart', () => {
        const params = parser.parseMethodParameters(
            'public String upload(@RequestPart("file") MultipartFile file) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].source, 'form');
        assert.strictEqual(params[0].name, 'file');
    });

    test('Should parse @ModelAttribute', () => {
        const params = parser.parseMethodParameters(
            'public String login(@ModelAttribute LoginForm form) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].source, 'form');
        assert.strictEqual(params[0].name, 'form');
    });

    test('Should handle no parameter annotations', () => {
        const params = parser.parseMethodParameters(
            'public String getAll() {}'
        );
        assert.strictEqual(params.length, 0);
    });

    test('Should parse @RequestHeader', () => {
        const params = parser.parseMethodParameters(
            'public String get(@RequestHeader("X-Api-Key") String apiKey) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'X-Api-Key');
        assert.strictEqual(params[0].source, 'header');
        assert.strictEqual(params[0].type, 'String');
    });

    test('Should parse @RequestHeader with defaultValue', () => {
        const params = parser.parseMethodParameters(
            'public String get(@RequestHeader(value = "Accept", defaultValue = "application/json") String accept) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'Accept');
        assert.strictEqual(params[0].source, 'header');
        assert.strictEqual(params[0].isRequired, false);
        assert.strictEqual(params[0].defaultValue, 'application/json');
    });
});
