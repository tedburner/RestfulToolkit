# Tasks

## 1. Cross-Platform Path Normalization, Cache Slimming & Baseline Tests

- [x] 1.1 Fix Windows root path construction in `src/test/config/ConfigManager.test.ts` and verify `npm test` passes all existing Mocha suites on Windows.
- [x] 1.2 Add `src/utils/PathUtils.ts` (`normalizePathKey` and glob slash helpers) and apply canonical path keys across `EndpointCache`, `ScanStateManager`, `FileScanner`, `ConfigManager`, and `FileWatcher` (including case-insensitive Windows watcher exclusion matching), verifying with unit tests in `EndpointCache.test.ts`, `FileScanner.test.ts`, and `FileWatcher.test.ts`.
- [x] 1.3 Remove the write-only `endpoints` path Map from `EndpointCache` and add a non-logging `ConfigManager.getMaxResults(resourceUri?)` helper used by `SearchUI`, verifying via `EndpointCache.test.ts` and `SearchUI.test.ts` that search results are unchanged and keystrokes emit no `Effective scan config` log lines.

## 2. Lexical Sanitization & Annotation Parser Hardening

- [x] 2.1 Add Java text-block (`"""..."""` with backslash escapes) and Kotlin raw-string (`"""..."""` with literal backslashes and trailing quotes) support to `TextProcessor.sanitize`, verifying with unit tests in `TextProcessor.test.ts` and `AnnotationParser.test.ts` (including embedded `"http://..."`, single quotes, and braces).
- [x] 2.2 Add framework annotation pre-checks per class block in `AnnotationParser.parseFileResult` so pure-Spring and pure-JAX-RS classes skip the unused parser while mixed-framework files retain all endpoints, verifying with `AnnotationParser.test.ts`, `test-sample.js`, and `test-all-files.js` (and updating parser notes in `AGENTS.md` / `CLAUDE.md`).

## 3. Endpoint Method Resolution, Parameter Extraction & DTO Expansion

- [x] 3.1 Upgrade `ParameterExtractor` to locate direct class/interface/object member methods and their full multi-line annotation ranges structurally (covering `byte[]`/array return types, generic functions, multi-line `@PostMapping(consumes = ...)`, and cursor placement on `return`/`throw`/`new` statements inside method bodies), verifying with reproduction and regression tests in `ParameterExtractor.test.ts`.
- [x] 3.2 Upgrade `SpringParameterParser` and `JaxRsParameterParser` to scan all parameter annotations (handling `@RequestBody @Valid`, `@RequestParam(...) @NotBlank`, fully-qualified annotations, and `name = "..."`), plus array (`String[]`, `byte[]`), vararg, and multi-argument generic parameter types (`Map<String, Object>`), verifying with `SpringParameterParser.test.ts`, `JaxRsParameterParser.test.ts`, and `test-parameter-copy.js`.
- [x] 3.3 Upgrade `DtoFieldExtractor` to skip `static`, `transient`, and `@JsonIgnore` fields, parse Java `record` components and multi-attribute `@JsonProperty(value = "...")`, wrap `findFiles` exclusions in `{...}` (honoring configured `excludePaths` and stripping Kotlin `?`), and resolve sibling nested DTO fields concurrently via `Promise.all`, verifying with `DtoFieldExtractor.test.ts` and updating extractor documentation in `AGENTS.md` / `CLAUDE.md` / `README.md` / `README_CN.md`.

## 4. Base URL Resolution & Slash-Safe URL/cURL Assembly

- [x] 4.1 Constrain `BaseUrlResolver` YAML `server:` extraction to top-level indentation, strip unquoted inline `#` comments on headers and values in YAML/Properties, honor `spring.profiles.active` when declared (preserving existing fallback when absent), parallelize `searchDirAsync` deterministically, and prefer the nearest module's `src/main/resources` when `resourceUri` is provided, verifying with `BaseUrlResolver.test.ts` and `test-copy-url-curl.js`.
- [x] 4.2 Normalize boundary slashes across `ConfigManager.getBaseUrlAsync`, `UrlGenerator`, and `CurlConverter` so trailing `/` in `baseUrl` or `context-path: /` never produces `//`, verifying with `UrlGenerator.test.ts`, `CurlConverter.test.ts`, `CopyUrlCurlCommand.test.ts`, and updating Base URL docs in `AGENTS.md` / `CLAUDE.md` / `README.md` / `README_CN.md`.

## 5. JSON-to-DTO Generation, Command UX & Extension Polish

- [x] 5.1 Fix `JsonClassGenerator` empty/leading-digit identifier fallback after camelCase/PascalCase conversion for symbol/underscore/non-ASCII keys (such as `"$"`, `"___"`, `"中文"`) and omit unused `import java.util.List;` when Java DTOs have no list fields, verifying with `JsonClassGenerator.test.ts`, `test-json-to-class.js`, and `npm run test:dto-compile` (`javac` compilation).
- [x] 5.2 Wire `restfulToolkit.copyNameFormat` in `ConfigManager` and `CopyEndpointParametersCommand` (preserving underscore auto-detection when unconfigured), display format icons and an accurate recommended badge in the format QuickPick, fix `JsonToClassCommand` Escape cancellation on the Lombok prompt, add multi-root folder selection and existing-file feedback to `createProjectConfig`, read extension version dynamically in `extension.ts`, and remove orphaned NLS keys, verifying with `CopyEndpointParametersCommand.test.ts`, `JsonToClassCommand` tests, and `extension.test.ts`.

## 6. CI Matrix, Documentation Closeout & Full Integration Verification

- [x] 6.1 Add `.github/workflows/ci.yml` (`push` and `pull_request` across `ubuntu-latest` and `windows-latest`) and add `node src/test/scripts/test-json-to-class.js` to `.github/workflows/publish.yml`, verifying workflow YAML syntax and script coverage.
- [x] 6.2 Reconcile `CHANGELOG.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `README_CN.md`, and `docs/DOCUMENTATION_MANIFEST.md` so all architecture notes, UI descriptions, script counts, and dates reflect the current implementation without drift.
- [x] 6.3 Run full end-to-end verification (`npm test`, `npm run build`, `npm run test:marketplace-stats`, `npm run test:dto-compile`, `npm run test:curl-semantic`, `test-sample.js`, `test-all-files.js`, `test-copy-url-curl.js`, `test-parameter-copy.js`, `test-json-to-class.js`) and confirm zero errors or regressions.

## Workflow follow-up

Review completed implementation and verification output before archiving `harden-parsing-cross-platform-and-perf` via OpenSpec archive workflow.
