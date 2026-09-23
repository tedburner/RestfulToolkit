import * as assert from 'assert';
import { ParameterExtractor } from '../../extractor/ParameterExtractor';
import * as vscode from 'vscode';

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
});
