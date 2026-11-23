# Proposal

## Why

A comprehensive audit of RestfulToolkit v0.0.10 uncovered reproducible correctness defects across Java 15+/Kotlin `"""..."""` text-block sanitization, multi-annotation/array parameter extraction, multi-line endpoint copy method resolution, DTO `static`/`record` field handling, non-ASCII/symbol JSON-to-DTO identifier generation, and Spring YAML Base URL resolution (`management.server.port` hijacking, inline `#` comments, and `//` URL joining). At the same time, `npm test` currently fails 3 `ConfigManager` tests on Windows without PR/push CI coverage, Windows path-case normalization is inconsistent across cache/watcher layers, `restfulToolkit.copyNameFormat` is unwired, and several hot-path allocations/log calls remain avoidable.

## What Changes

- Harden `TextProcessor.sanitize()` to handle Java text blocks and Kotlin raw strings (`"""..."""`), and add lightweight framework annotation pre-checks in `AnnotationParser` so single-framework files skip irrelevant parser passes while preserving mixed-framework support.
- Upgrade `ParameterExtractor` to locate direct member methods and full multi-line annotation blocks structurally (covering `byte[]`/array return types, generic methods, and ignoring method-body `return`/`throw`/`new` calls), and upgrade `SpringParameterParser` / `JaxRsParameterParser` to support `name = "..."`, multiple/interleaved parameter annotations (`@RequestBody @Valid`, `@NotBlank`), array types, and multi-argument generics.
- Refine `DtoFieldExtractor` to skip `static`, `transient`, and `@JsonIgnore` fields, support Java `record` components and multi-attribute `@JsonProperty(value = "...")`, fix VS Code `findFiles` `{...}` brace exclusion syntax (incorporating configured exclusions), and resolve sibling nested DTO fields concurrently with branch-local cycle protection.
- Fix `JsonClassGenerator` empty/numeric identifier generation on symbol-only or non-ASCII JSON keys and omit unused `java.util.List` imports when not needed; fix `JsonToClassCommand` Escape cancellation on the Lombok prompt, `CopyEndpointParametersCommand` `copyNameFormat` wiring and default-format badge/icon display, and multi-root / existing-file feedback in `createProjectConfig`.
- Harden `BaseUrlResolver` and URL assembly: restrict YAML `server:` extraction to top-level keys, strip inline `#` comments, honor `spring.profiles.active` when declared, parallelize directory discovery, prefer the module nearest to the active `resourceUri` in multi-module workspaces, and prevent `//` double slashes when `baseUrl` or `context-path` ends with `/`.
- Unify Windows path-key normalization across `FileScanner`, `EndpointCache`, `ScanStateManager`, `ConfigManager`, and `FileWatcher`; remove the write-only `EndpointCache.endpoints` path index; eliminate per-keystroke `OutputChannel` INFO logging when reading `maxResults`; fix Windows `ConfigManager.test.ts` failures; add `ubuntu-latest` + `windows-latest` CI workflow coverage (including `test-json-to-class.js`); dynamicize the activation version log; clean orphaned NLS entries; and synchronize project documentation.

## Capabilities

### New Capabilities
- `lexical-and-annotation-parsing`: Triple-quoted string sanitization for Java/Kotlin and framework-prechecked class block parsing without losing mixed-framework compatibility.
- `endpoint-parameter-and-dto-extraction`: Structural method/annotation resolution for editor copy flows, complete Spring/JAX-RS parameter annotation/type parsing, and accurate concurrent DTO/record field expansion.
- `dto-code-generation-and-command-ux`: Valid identifier fallback and clean imports for JSON-to-DTO generation, wired `copyNameFormat` preference and accurate picker labels, Escape cancellation consistency, and multi-root config template creation feedback.
- `base-url-resolution-and-url-joining`: Top-level comment-aware YAML/Properties Base URL detection with active-profile and nearest-module resolution plus slash-safe URL assembly.
- `cross-platform-consistency-and-runtime-efficiency`: Consistent Windows path-case handling, removal of write-only cache index and hot-path search log noise, cross-platform unit tests, and automated CI verification.

### Modified Capabilities
None. `openspec list --specs` reports no existing canonical capability specs.

## Impact

- **Affected source**: `src/utils/TextProcessor.ts`, `src/utils/PathUtils.ts` (shared path helper), `src/utils/BaseUrlResolver.ts`, `src/utils/FileWatcher.ts`, `src/parsers/AnnotationParser.ts`, `src/scanner/FileScanner.ts`, `src/cache/EndpointCache.ts`, `src/cache/ScanStateManager.ts`, `src/config/ConfigManager.ts`, `src/config/ScanConfig.ts`, `src/extractor/ParameterExtractor.ts`, `src/extractor/SpringParameterParser.ts`, `src/extractor/JaxRsParameterParser.ts`, `src/extractor/DtoFieldExtractor.ts`, `src/extractor/UrlGenerator.ts`, `src/extractor/CurlConverter.ts`, `src/extractor/i18n.ts`, `src/generator/JsonClassGenerator.ts`, `src/generator/JsonTypeMapper.ts`, `src/commands/CopyEndpointParametersCommand.ts`, `src/commands/JsonToClassCommand.ts`, `src/ui/SearchUI.ts`, `src/extension.ts`, `package.nls.json`, `package.nls.zh-cn.json`.
- **Affected tests & CI**: `src/test/**`, `.github/workflows/ci.yml` (new), `.github/workflows/publish.yml`.
- **Affected docs**: `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `README.md`, `README_CN.md`, `docs/DOCUMENTATION_MANIFEST.md`.
- **Compatibility**: Fully backward-compatible with existing `.restful-toolkit.json` and VS Code settings; no new runtime npm dependencies.
