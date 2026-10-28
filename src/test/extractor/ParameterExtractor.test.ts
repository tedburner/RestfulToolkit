import * as assert from 'assert';
import { ParameterExtractor } from '../../extractor/ParameterExtractor';
import { CurlConverter } from '../../extractor/CurlConverter';
import * as vscode from 'vscode';

function createDocument(text: string, fileName: string): vscode.TextDocument {
    return {
        getText: () => text,
        uri: vscode.Uri.file(`C:/workspace/${fileName}`)
    } as unknown as vscode.TextDocument;
}

interface ParameterExtractorPathAccess {
    extractPathFromAnnotationText(annotationText: string): string | null;
}

suite('ParameterExtractor Test Suite', () => {
    test('uses the first declared path when a mapping annotation contains multiple paths', () => {
        const extractor = new ParameterExtractor() as unknown as ParameterExtractorPathAccess;

        assert.strictEqual(
            extractor.extractPathFromAnnotationText('@GetMapping({"/items", "/products/alt"})'),
            '/items'
        );
        assert.strictEqual(
            extractor.extractPathFromAnnotationText('@RequestMapping(path = {"/api", "/api/v2"})'),
            '/api'
        );
    });

    test('uses shared parsed route metadata for a package-private method', async () => {
        const text = `@RequestMapping("/api")\nclass ApiController {\n    @PostMapping\n    void save() {}\n}`;
        const document = {
            getText: () => text,
            uri: vscode.Uri.file('C:/workspace/ApiController.java')
        } as unknown as vscode.TextDocument;

        const result = await new ParameterExtractor().extract(document, { line: 3, character: 5 } as vscode.Position);
        assert.ok(result);
        assert.strictEqual(result?.httpMethod, 'POST');
        assert.strictEqual(result?.path, '/api');
    });

    test('locates Kotlin methods without visibility modifiers for copy commands', async () => {
        const text = `@RequestMapping("/api")\nclass ApiController {\n    @GetMapping\n    fun list() {}\n}`;
        const document = {
            getText: () => text,
            uri: vscode.Uri.file('C:/workspace/ApiController.kt')
        } as unknown as vscode.TextDocument;

        const result = await new ParameterExtractor().extract(document, { line: 3, character: 8 } as vscode.Position);
        assert.ok(result);
        assert.strictEqual(result?.httpMethod, 'GET');
        assert.strictEqual(result?.path, '/api');
    });

    test('extracts parameters with explicit annotation names on Java methods', async () => {
        const text = `class C {\n    @GetMapping("/a")\n    public void a(@RequestParam("q") String q, @PathVariable("id") Long id) {}\n}`;
        const document = {
            getText: () => text,
            uri: vscode.Uri.file('C:/workspace/C.java')
        } as unknown as vscode.TextDocument;

        const result = await new ParameterExtractor().extract(document, { line: 2, character: 10 } as vscode.Position);
        assert.ok(result, 'annotated parameters must not break method location');
        assert.strictEqual(result?.parameters.length, 2);
        assert.strictEqual(result?.parameters[0].name, 'q');
        assert.strictEqual(result?.parameters[0].type, 'String');
        assert.strictEqual(result?.parameters[1].name, 'id');
        assert.strictEqual(result?.parameters[1].source, 'path');
    });

    test('reads Kotlin parameter types declared after the parameter name', async () => {
        const text = `class C {\n    @GetMapping("/a")\n    fun a(@RequestParam q: String) {}\n}`;
        const document = {
            getText: () => text,
            uri: vscode.Uri.file('C:/workspace/C.kt')
        } as unknown as vscode.TextDocument;

        const result = await new ParameterExtractor().extract(document, { line: 2, character: 8 } as vscode.Position);
        assert.ok(result);
        assert.strictEqual(result?.parameters.length, 1);
        assert.strictEqual(result?.parameters[0].type, 'String');
        assert.strictEqual(result?.parameters[0].originalCaseName, 'q');
    });

    test('locates methods whose signature spans multiple lines', async () => {
        const text = [
            'class C {',
            '    @GetMapping("/a")',
            '    public void a(',
            '            @RequestParam("q") String q,',
            '            @PathVariable("id") Long id) {',
            '    }',
            '}'
        ].join('\n');
        const document = createDocument(text, 'MultiLine.java');

        const result = await new ParameterExtractor().extract(document, { line: 2, character: 10 } as vscode.Position);
        assert.ok(result, 'a multi-line signature must still be located');
        assert.strictEqual(result?.parameters.length, 2);
        assert.strictEqual(result?.parameters[0].type, 'String');
        assert.strictEqual(result?.parameters[0].source, 'query');
        assert.strictEqual(result?.parameters[1].type, 'Long');
        assert.strictEqual(result?.parameters[1].source, 'path');
    });

    test('reads Kotlin parameter types when a default value follows the declaration', async () => {
        const text = `class C {\n    @GetMapping("/a")\n    fun a(@RequestParam q: String = "x") {}\n}`;
        const document = createDocument(text, 'Defaults.kt');

        const result = await new ParameterExtractor().extract(document, { line: 2, character: 8 } as vscode.Position);
        assert.ok(result);
        assert.strictEqual(result?.parameters.length, 1);
        assert.strictEqual(result?.parameters[0].type, 'String');
        assert.strictEqual(result?.parameters[0].originalCaseName, 'q');
    });

    test('extracts the next method after a body that contains method calls', async () => {
        const text = [
            'class C {',
            '    @GetMapping("/a")',
            '    public String a() {',
            '        return service();',
            '    }',
            '',
            '    @PostMapping("/b")',
            '    public String b(@RequestParam("q") String q) {',
            '        return "ok";',
            '    }',
            '}'
        ].join('\n');
        const document = createDocument(text, 'Bodies.java');

        const result = await new ParameterExtractor().extract(document, { line: 7, character: 10 } as vscode.Position);
        assert.ok(result, 'a call statement in a previous body must not break the next method');
        assert.strictEqual(result?.httpMethod, 'POST');
        assert.strictEqual(result?.path, '/b');
        assert.strictEqual(result?.parameters.length, 1);
        assert.strictEqual(result?.parameters[0].name, 'q');
    });

    test('does not leak annotations from a skipped Kotlin expression body to the next method', async () => {
        const text = [
            'class C {',
            '    @GetMapping("/e")',
            '    fun e() = service()',
            '',
            '    @PostMapping("/f")',
            '    fun f(): String {',
            '        return "ok"',
            '    }',
            '}'
        ].join('\n');
        const document = createDocument(text, 'ExpressionBody.kt');

        const result = await new ParameterExtractor().extract(document, { line: 5, character: 8 } as vscode.Position);
        assert.ok(result);
        assert.strictEqual(result?.httpMethod, 'POST', 'the @GetMapping of the skipped member must not leak to f');
        assert.strictEqual(result?.path, '/f');
    });

    test('keeps query parameters on POST when producing a curl command end to end', async () => {
        const text = [
            'class C {',
            '    @PostMapping("/users")',
            '    public String create(@RequestParam("source") String source, @RequestBody UserDto user) {',
            '        return "ok";',
            '    }',
            '}'
        ].join('\n');
        const document = createDocument(text, 'CreateUserController.java');

        const info = await new ParameterExtractor().extract(
            document,
            { line: 2, character: 10 } as vscode.Position,
            { expandDto: false }
        );
        assert.ok(info, 'the copy entry point must extract a method with annotated parameters');
        assert.strictEqual(info?.httpMethod, 'POST');
        assert.strictEqual(info?.contentType, 'json');

        const curl = new CurlConverter().generate(info!, 'http://localhost:8080');
        assert.ok(
            curl.includes("curl -X POST 'http://localhost:8080/users?source='"),
            'query parameters must be kept in the POST URL, not dropped'
        );
        assert.ok(curl.includes("Content-Type: application/json'"));
        assert.ok(curl.includes('{"user": ""}'), 'the body parameter must produce a JSON placeholder');
    });

    test('generates Spring multipart and urlencoded bodies from RequestParam declarations', async () => {
        for (const [mediaType, expected] of [
            ['multipart/form-data', ["-F 'file=@/path/to/file'", "-F 'note='"]],
            ['application/x-www-form-urlencoded', ["-d 'file=&note='"]]
        ] as Array<[string, string[]]>) {
            const text = `class C {\n    @PostMapping(value = "/upload", consumes = "${mediaType}")\n    public void upload(@RequestParam("file") MultipartFile file, @RequestParam("note") String note) {}\n}`;
            const info = await new ParameterExtractor().extract(createDocument(text, 'Upload.java'),
                { line: 2, character: 10 } as vscode.Position, { expandDto: false });
            assert.ok(info);
            const curl = new CurlConverter().generate(info!, 'http://localhost');
            for (const part of expected) { assert.ok(curl.includes(part), curl); }
            assert.ok(!curl.includes('/upload?'), curl);
        }
    });

    test('skips DTO file I/O when expandDto is false and defers it to expandDtoFields', async () => {
        const text = [
            'class C {',
            '    @GetMapping("/dto")',
            '    public String get(@RequestBody UserDto user) {',
            '        return "ok";',
            '    }',
            '}'
        ].join('\n');
        const document = createDocument(text, 'DtoController.java');

        const originalFindFiles = vscode.workspace.findFiles;
        let findFilesCalls = 0;
        vscode.workspace.findFiles = (async (...args: Parameters<typeof originalFindFiles>) => {
            findFilesCalls++;
            return originalFindFiles(...args);
        }) as typeof vscode.workspace.findFiles;

        try {
            const extractor = new ParameterExtractor();
            const info = await extractor.extract(
                document,
                { line: 2, character: 10 } as vscode.Position,
                { expandDto: false }
            );
            assert.ok(info);
            assert.strictEqual(findFilesCalls, 0, 'expandDto:false must not trigger DTO file discovery');
            assert.strictEqual(info?.dtoFields.size, 0);

            await extractor.expandDtoFields(info!, document);
            assert.ok(findFilesCalls > 0, 'the deferred expansion performs the file I/O once requested');
        } finally {
            vscode.workspace.findFiles = originalFindFiles;
        }
    });
});
