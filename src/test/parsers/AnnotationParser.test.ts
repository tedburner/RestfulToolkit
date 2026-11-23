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

    test('preserves endpoints after Java text blocks and Kotlin raw strings', () => {
        const javaContent = `@RestController
public class DemoController {
    @GetMapping("/a")
    public String a() {
        return """
            {"url": "http://example.com", "quote": "it's ok"}
            """;
    }

    @GetMapping("/b")
    public String b() {
        return "ok";
    }
}`;
        const javaEndpoints = parser.parseFile(javaContent, 'DemoController.java');
        assert.deepStrictEqual(
            javaEndpoints.map(e => ({ path: e.path, line: e.line })),
            [{ path: '/a', line: 3 }, { path: '/b', line: 10 }]
        );

        const ktContent = `@RestController
class KtController {
    @GetMapping("/first")
    fun first(): String {
        val winPath = """C:\\temp\\"""
        return winPath
    }

    @PostMapping("/second")
    fun second(): String {
        return "ok"
    }
}`;
        const ktEndpoints = parser.parseFile(ktContent, 'KtController.kt');
        assert.deepStrictEqual(
            ktEndpoints.map(e => ({ path: e.path, line: e.line })),
            [{ path: '/first', line: 3 }, { path: '/second', line: 9 }]
        );
    });

    test('skips irrelevant framework parser on single-framework classes while supporting mixed files', () => {
        const internals = parser as unknown as {
            jaxRsParser: { parseMethodAnnotations: (...args: unknown[]) => unknown[] };
            springMvcParser: { parseMethodAnnotations: (...args: unknown[]) => unknown[] };
        };
        let jaxRsCalls = 0;
        const origJaxRs = internals.jaxRsParser.parseMethodAnnotations.bind(internals.jaxRsParser);
        internals.jaxRsParser.parseMethodAnnotations = (...args: unknown[]) => {
            jaxRsCalls++;
            return origJaxRs(...(args as Parameters<typeof origJaxRs>));
        };

        const pureSpring = `@RestController
public class PureSpringController {
    @GetMapping("/only-spring")
    public String hello() { return "hi"; }
}`;
        const springEndpoints = parser.parseFile(pureSpring, 'PureSpringController.java');
        assert.strictEqual(springEndpoints.length, 1);
        assert.strictEqual(jaxRsCalls, 0, 'pure Spring class block should skip JAX-RS parser');

        const mixed = `@RestController
public class MixedFile {
    @GetMapping("/spring")
    public String s() { return "s"; }

    @Path("/jaxrs")
    static class JaxResource {
        @GET
        public String j() { return "j"; }
    }
}`;
        const mixedEndpoints = parser.parseFile(mixed, 'MixedFile.java');
        assert.strictEqual(mixedEndpoints.length, 2);
        assert.strictEqual(jaxRsCalls, 1, 'mixed file should invoke JAX-RS parser only on the JAX-RS class block');
    });
});
