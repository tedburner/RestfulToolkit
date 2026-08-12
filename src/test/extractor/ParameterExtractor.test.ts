import * as assert from 'assert';
import { ParameterExtractor } from '../../extractor/ParameterExtractor';

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
});
