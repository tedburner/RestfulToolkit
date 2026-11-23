# Design

## Context

See `proposal.md` for motivation and audit findings. RestfulToolkit v0.0.10 already features solid concurrency primitives (`fileVersions`, `mtime + size` atomic commits, bounded watcher/scan queues, and bounded top-K search heaps), so this upgrade focuses on surgical, behavior-preserving hardening where lexical/structural assumptions, platform path normalization, or hot-path bookkeeping fall short—without adding runtime dependencies or persistent state.

## Goals / Non-Goals

**Goals:**
- Make lexical sanitization and member/parameter/DTO parsing resilient to modern Java 17+/Kotlin syntax (`"""..."""`, `record`, `@Valid` + binding annotations, `name =`, arrays, multi-line mappings).
- Unify Windows/POSIX path-key normalization across cache, scan state, config, watcher, and tests, backed by Linux + Windows CI.
- Fix Base URL YAML hierarchy/comment/profile/module edge cases and slash normalization while keeping `vscode.workspace.fs.readDirectory` compatibility with isolated temp-directory tests.
- Remove hot-path waste (write-only `EndpointCache.endpoints` Map, per-keystroke `getScanConfig` INFO logs, serial sibling DTO file lookups) and polish minor command UX gaps.

**Non-Goals:**
- Full AST compiler integration (e.g., Java Language Server / Kotlin compiler daemon dependency).
- Cross-file class inheritance or `@Configuration` bean route evaluation (remain documented known limitations).
- Persistent disk caching across VS Code sessions.

## Decisions

### 1. Triple-Quoted String Sanitization & Framework Pre-Check
- **Decision**: Extend `TextProcessor.sanitize(code, options?: { preserveStrings?: boolean; rawTripleQuotes?: boolean })` (or detect `"""` directly):
  - When encountering `"""` at `i` (`chars[i..i+2] === '"""'`), advance until the closing `"""`. For Java files (`rawTripleQuotes !== true`), `\` escapes the next character inside `"""..."""` (handling `\"` and `\"""`); for Kotlin files (`filePath.endsWith('.kt')`, `rawTripleQuotes: true`), backslashes inside raw strings are literal per Kotlin language rules, and trailing `""""` sequences close on the last `"""` (or first `"""` with standard raw-string rules—specifically in Kotlin `"""foo""""` has `"` followed by closing `"""`, so advancing over extra `"` past 3 consecutive quotes handles trailing quotes inside raw strings cleanly!). All non-newline characters inside `"""..."""` are replaced with spaces when `preserveStrings` is `false`.
  - In `AnnotationParser.parseFileResult`, test `classBlockSanitized` against fast Spring (`/@(?:[\w.]+\.)?(?:Request|Get|Post|Put|Delete|Patch)Mapping\b/`) and JAX-RS (`/@(?:[\w.]+\.)?(?:Path|GET|POST|PUT|DELETE|PATCH)\b/`) patterns before invoking `parseSpringMvc` / `parseJaxRs`.
- **Alternatives considered**: Bundling a third-party lexer (`chevrotain`/`tree-sitter`) — rejected because zero runtime dependencies keep VSIX tiny and activation instant.

### 2. Structural Enclosing-Method Resolution & Token-Aware Parameter/DTO Parsing
- **Decision**:
  - **Enclosing method resolution (`ParameterExtractor`)**: Instead of fragile line-by-line backward regex heuristics that match `return helper(x)` or fail on `byte[]` / multi-line `@PostMapping(...)`, scan class blocks on `sanitized` text (reusing `AnnotationParser` class-block boundaries + direct-member scanning analogous to `JaxRsParser.collectDirectMethodDeclarations`) to record each direct member method's `{ annotationStartOffset, declarationOffset, openParenOffset, closeParenOffset, bodyEndOffset, className, methodName }`. Map `position.line` to the member method whose `[annotationStartLine, bodyEndLine]` contains the cursor (or whose declaration/annotation immediately follows blank lines at the cursor). Extract full raw `annotations` (`text.substring(annotationStartOffset, declarationOffset)`) so multi-line `consumes = ...` is always intact!
  - **Parameter parsing (`SpringParameterParser` & `JaxRsParameterParser`)**: Walk leading annotations on each split parameter using balanced-parenthesis + quote-aware scanning (`skipAnnotation` / `extractAnnotationForward`), inspecting all annotations on that parameter to find the target Spring/JAX-RS binding annotation regardless of whether `@Valid`, `@NotBlank`, `@Schema(...)`, or package prefixes (`org.springframework.web.bind.annotation.RequestParam`) appear before or after it. Support both `value = "..."` and `name = "..."` in `extractAnnotationNameValue`. Parse the remaining `type` and `varName` from the parameter tail (handling Kotlin `name: Type? = default` and Java `[final] Type<K, V>[]... varName`).
  - **DTO field extraction (`DtoFieldExtractor`)**:
    - Exclude Java fields with `static` or `transient` modifiers and fields preceded by `@JsonIgnore` (or `@JsonProperty(access = JsonProperty.Access.READ_ONLY)` if present; keep `@JsonIgnore` primary).
    - Support Java `record Name(Component... )` headers by extracting the record header parameter list and parsing each component's `@JsonProperty`/`@JsonAlias`/`@JSONField` annotations, type, and name alongside body fields.
    - Support `@JsonProperty(value = "...")` multi-attribute syntax in addition to `@JsonProperty("...")`.
    - Wrap multi-glob `findFiles` exclusions in `{...}` (`{**/node_modules/**,**/target/**,**/build/**,**/.git/**,**/src/test/**}` merged with configured exclusions) and strip Kotlin nullable `?` from generic inner type names before file lookup.
    - Resolve sibling nested DTO fields via `Promise.all` where each branch receives `new Set(visited)` so sibling fields parallelize I/O while preserving branch-local cycle bounds.

### 3. Generator Identifier Safety & Command UX Polish
- **Decision**:
  - In `JsonClassGenerator`, apply empty-string and leading-digit fallback *after* `toCamelCase` / `toPascalCase` (`allocateFieldName`: fallback `'field'`; `getNestedClassName`: fallback `'Item'`) so `"$"`, `"___"`, and `"中文"` produce `field`, `field2`, and `Item` rather than `""` and `"2"`. Check whether any generated `ClassDef` in the tree contains a `List<` field before emitting `import java.util.List;` in Java.
  - In `ConfigManager`, add `getMaxResults(resourceUri?)` (no `INFO` log) and `getExplicitCopyNameFormat(resourceUri?): 'camelCase' | 'snake_case' | undefined`. In `CopyEndpointParametersCommand`, honor explicit `copyNameFormat` (`snake_case` -> `toSnakeCase`, `camelCase` -> `toCamelCase` on non-explicitly-renamed fields, or when unconfigured preserve the existing >50% underscore auto-detection), prepend `f.icon` to QuickPick labels, and use a dedicated `recommended` i18n label (`推荐` / `Recommended`) instead of `labels.nameFormat`.
  - Change `JsonToClassCommand.selectLombok()` return type to `Promise<boolean | undefined>` and abort `executeInFolder` when `undefined`.
  - In `createProjectConfig`, prompt with `vscode.window.showWorkspaceFolderPick()` when multiple workspace folders exist (preferring active editor's folder as default context if single or unambiguous) and show an informational/warning message when `.restful-toolkit.json` already exists.

### 4. Base URL YAML Hierarchy, Profile/Module Resolution & Slash Joining
- **Decision**:
  - Constrain `BaseUrlResolver.extractYamlBlock(content, 'server')` via an optional `expectedIndent = 0` parameter (`expectedIndent: number | null = 0` for top-level `server`, `null` or `> parentIndent` for nested `servlet` inside `serverBlock`), preventing `management:\n  server:\n    port: 9090` from matching top-level `server:`.
  - Strip unquoted `# ...` inline comments in YAML lines (both header lines like `server: # comment` and value lines like `port: 8081 # comment`) and Properties values before validation.
  - Extract `spring.profiles.active` from base `application.*` and `bootstrap.*` files; when non-empty (and free of unresolved `${...}` without default), apply matching `application-{profile}.*` files in declared active-profile order; when `spring.profiles.active` is absent or unresolved, preserve existing fallback behavior across discovered `application-{profile}.*` files so single-profile projects without explicit `active` in static YAML continue working.
  - Parallelize sibling directory reads in `searchDirAsync` with `Promise.all` (preserving deterministic sorted entry order so merge precedence never depends on OS async timing!). Accept optional `resourcePath?: string` in `resolveAsync(workspaceFolder, resourcePath?)`: if multiple `src/main/resources` directories exist and one is inside the same module ancestor as `resourcePath` (e.g., `<module>/src/main/java/...` matching `<module>/src/main/resources`), resolve from that module first (falling back to workspace-wide merge if that module defines neither port nor context-path); cache results keyed by `(workspaceFolder, matchedResourcesDir || '')`.
  - Normalize URL joining in a shared helper used by `ConfigManager.getBaseUrlAsync`, `UrlGenerator`, and `CurlConverter`: strip trailing `/` from `baseUrl`, ensure non-empty `contextPath` (other than `/`, which normalizes to `''`) starts with `/` and has no trailing `/`, and ensure endpoint `path` starts with `/` when non-empty.

### 5. Cross-Platform Path Normalization, Cache Slimming & CI Matrix
- **Decision**:
  - Introduce `src/utils/PathUtils.ts` (`normalizePathKey(fsPath: string): string` using `path.normalize` + `toLowerCase()` on `win32`, forward-slash helper for globs) and use canonical keys internally in `EndpointCache.fileIndex`, `ScanStateManager.scanRecords`, `FileScanner.fileVersions` / `debounceTimers` / `pendingWatcherFiles` / `inFlightWatcherFiles`, `ConfigManager.projectConfigs`, and `FileWatcher` (`shouldIgnore` folder comparison + `i` flag on `compileGlob` RegExp when `process.platform === 'win32'`), while keeping original `endpoint.file` display casing for `openTextDocument`.
  - Remove write-only `private endpoints: Map<string, SearchableEndpoint[]>` from `EndpointCache`.
  - Update `ConfigManager.test.ts` to build roots via `vscode.Uri.file(...)` (or `path.resolve`) so test map keys match `ConfigManager.loadProjectConfigs()` identically on both Windows (`F:\...`) and POSIX (`/workspace/...`).
  - Add `.github/workflows/ci.yml` running compile, lint, Mocha tests, and all batch/smoke scripts across `[ubuntu-latest, windows-latest]` on `push` (`master`/`main`) and `pull_request`, and add `node src/test/scripts/test-json-to-class.js` to `.github/workflows/publish.yml`.

## Risks / Trade-offs

- **[Risk] Changing method-at-cursor resolution could alter behavior when cursor sits on blank lines between two methods** → **Mitigation**: Preserve forward-fallback onto the next method within the same class block when cursor is on/above annotations, and stop at `}` of the preceding method; cover declaration line, annotation line, multi-line annotation middle line, body return-call line, and array-return line in `ParameterExtractor.test.ts`.
- **[Risk] Parallelizing `searchDirAsync` could make multi-module merge order non-deterministic** → **Mitigation**: Sort directory entries alphabetically before `Promise.all` and flatten child results in deterministic array order.
- **[Risk] Honoring `spring.profiles.active` could change behavior if a test has `application-dev.yml` without `spring.profiles.active`** → **Mitigation**: Only filter profile files when `spring.profiles.active` resolves to concrete profile name(s); otherwise keep existing profile-override behavior.

## Migration Plan

Drop-in upgrade with zero configuration migration required; `extension.ts` reads `context.extension.packageJSON.version` dynamically so activation logs stay aligned across releases, and changes are recorded under `CHANGELOG.md` (`[Unreleased]`) until the next tagged release (`v0.0.11`). Rollback is a standard VSIX version revert.
