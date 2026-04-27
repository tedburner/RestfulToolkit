import * as assert from 'assert';
import { JaxRsParameterParser } from '../../extractor/JaxRsParameterParser';

suite('JaxRsParameterParser Test Suite', () => {
    let parser: JaxRsParameterParser;

    setup(() => {
        parser = new JaxRsParameterParser();
    });

    test('Should parse @PathParam with explicit name', () => {
        const params = parser.parseMethodParameters(
            'public String get(@PathParam("id") Long id) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'id');
        assert.strictEqual(params[0].source, 'path');
        assert.strictEqual(params[0].type, 'Long');
    });

    test('Should parse @QueryParam with explicit name', () => {
        const params = parser.parseMethodParameters(
            'public String search(@QueryParam("keyword") String q) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'keyword');
        assert.strictEqual(params[0].source, 'query');
    });

    test('Should parse @FormParam with explicit name', () => {
        const params = parser.parseMethodParameters(
            'public String login(@FormParam("username") String user) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'username');
        assert.strictEqual(params[0].source, 'form');
    });

    test('Should parse @RequestBody (shared with Spring)', () => {
        const params = parser.parseMethodParameters(
            'public String create(@RequestBody OrderDto order) {}'
        );
        assert.strictEqual(params.length, 1);
        assert.strictEqual(params[0].name, 'order');
        assert.strictEqual(params[0].source, 'body');
    });

    test('Should parse multiple JAX-RS parameters', () => {
        const params = parser.parseMethodParameters(
            'public String update(@PathParam("id") Long id, @QueryParam("fields") String f, @RequestBody OrderDto order) {}'
        );
        assert.strictEqual(params.length, 3);
        assert.strictEqual(params[0].source, 'path');
        assert.strictEqual(params[1].source, 'query');
        assert.strictEqual(params[2].source, 'body');
    });

    test('Should handle no parameter annotations', () => {
        const params = parser.parseMethodParameters(
            'public String getAll() {}'
        );
        assert.strictEqual(params.length, 0);
    });
});
