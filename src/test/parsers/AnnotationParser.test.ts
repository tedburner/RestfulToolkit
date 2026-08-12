import * as assert from 'assert';
import { AnnotationParser } from '../../parsers/AnnotationParser';

suite('AnnotationParser Integration Test Suite', () => {
    let parser: AnnotationParser;

    setup(() => {
        parser = new AnnotationParser();
    });

    test('does not reuse a method-level Spring mapping as the class path', () => {
        const content = `public class ItemController {
    @RequestMapping("/items")
    public String items() { return "ok"; }
}`;

        const endpoints = parser.parseFile(content, 'ItemController.java');

        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/items');
        assert.strictEqual(endpoints[0].className, 'ItemController');
        assert.strictEqual(endpoints[0].line, 2);
    });

    test('does not reuse a method-level JAX-RS path as the class path', () => {
        const content = `public class ItemResource {
    @GET
    @Path("/items")
    public String items() { return "ok"; }
}`;

        const endpoints = parser.parseFile(content, 'ItemResource.java');

        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].path, '/items');
        assert.strictEqual(endpoints[0].className, 'ItemResource');
        assert.strictEqual(endpoints[0].line, 2);
    });

    test('keeps nested controller endpoints in their declaring classes with absolute lines', () => {
        const content = `@RequestMapping("/outer")
public class OuterController {
    @GetMapping("/a")
    public String outerEndpoint() { return "a"; }

    @RequestMapping("/inner")
    static class InnerController {
        @GetMapping("/b")
        public String innerEndpoint() { return "b"; }
    }
}`;

        const endpoints = parser.parseFile(content, 'NestedController.java');

        assert.deepStrictEqual(
            endpoints.map(endpoint => ({
                path: endpoint.path,
                className: endpoint.className,
                methodName: endpoint.methodName,
                line: endpoint.line
            })),
            [
                { path: '/outer/a', className: 'OuterController', methodName: 'outerEndpoint', line: 3 },
                { path: '/inner/b', className: 'InnerController', methodName: 'innerEndpoint', line: 8 }
            ]
        );
    });
});
