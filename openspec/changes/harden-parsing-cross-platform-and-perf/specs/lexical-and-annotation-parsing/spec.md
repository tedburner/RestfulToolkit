# Spec Delta

## Purpose

Ensure Java and Kotlin source files containing triple-quoted text blocks or raw strings are lexically sanitized without corrupting structural delimiters, and parse controller class blocks without redundant framework passes while preserving mixed-framework support.

## ADDED Requirements

### Requirement: Triple-quoted string literals do not corrupt structural parsing
The extension SHALL treat Java text blocks (`"""..."""`) and Kotlin raw strings (`"""..."""`) as string literals during lexical sanitization so embedded quotes, comment markers (`//`, `/*`), apostrophes, or braces inside them never alter line offsets or structural brace/parenthesis balance.

#### Scenario: Java text block contains JSON with URL and quotes
- **WHEN** a Java controller method or annotation contains a `"""..."""` text block with quoted URLs (such as `"http://example.com"`), single quotes, or braces
- **THEN** endpoint indexing still detects all endpoints declared before and after the text block with exact 1-based annotation line numbers

#### Scenario: Java text block contains escaped quotes
- **WHEN** a Java text block contains escaped double quotes such as `\"` or `\"""`
- **THEN** lexical sanitization does not terminate the text block prematurely and preserves all controller endpoints

#### Scenario: Kotlin raw string contains unescaped backslashes and quotes
- **WHEN** a Kotlin controller contains a `"""..."""` raw string with trailing backslashes (such as `"""C:\temp\"""`) or embedded single/double quotes
- **THEN** lexical sanitization terminates at the closing `"""` without treating `\` as an escape character and indexes all endpoints in the file

### Requirement: Single-framework class blocks skip irrelevant framework parsing without breaking mixed files
The extension SHALL avoid running framework-specific endpoint parsers on class blocks that contain none of that framework's route or HTTP verb annotations, while continuing to index both Spring and JAX-RS endpoints when both frameworks appear in the same file or class.

#### Scenario: Pure Spring controller file
- **WHEN** a controller class contains only Spring mapping annotations
- **THEN** all Spring endpoints are indexed identically and JAX-RS member scanning is skipped for that class block

#### Scenario: Mixed Spring and JAX-RS file
- **WHEN** a source file declares both Spring and JAX-RS endpoint annotations
- **THEN** endpoints from both frameworks are indexed with accurate paths, HTTP methods, and line numbers
