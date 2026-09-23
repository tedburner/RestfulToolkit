# Proposal

## Why

Endpoint search and editor copy commands interpret the same route annotations through separate code paths, so endpoints visible in search can produce different or missing copy metadata. Multi-root configuration can select another folder's Base URL, parser failures can be mistaken for successful empty parses, and DTO cycle tracking can suppress repeated sibling fields.

## What Changes

- Reuse indexed endpoint parsing for method route metadata in URL, cURL, and parameter-copy flows; recognize Spring mappings with an empty method path and methods without explicit visibility modifiers.
- Return an explicit parse result so failed parses preserve the last valid file cache.
- Resolve project and VS Code settings in the owning workspace folder, reload when `.restful-toolkit.json` changes, and route QuickPick result limits through `ConfigManager`.
- Make DTO cycle detection path-local so the same DTO can expand in separate sibling fields while actual recursive cycles remain bounded.
- Upgrade package and lockfile metadata to v0.0.9 and reconcile user-facing documentation.

## Capabilities

### New Capabilities

- `endpoint-copy-consistency`: Search and copy flows agree on route, method, pathless mapping, and Kotlin declaration metadata.
- `scan-cache-failure-safety`: Parse failures do not replace a file's last successful endpoint snapshot.
- `workspace-scoped-runtime-config`: Project configuration and result limits resolve consistently for the owning workspace folder and respond to project config file events.
- `dto-recursive-expansion`: DTO expansion repeats sibling DTO types while stopping cycles along the active recursion path.

### Modified Capabilities

None. `openspec list --specs` reports no existing canonical capability specs.

## Impact

- Affected code: `AnnotationParser`, Spring/JAX-RS route parsing, `ParameterExtractor`, `FileScanner`, `ConfigManager`, `SearchUI`, extension lifecycle watchers, and `DtoFieldExtractor`.
- Affected tests: parser, extractor, scanner, config, UI, and extension activation tests.
- Release metadata and docs: `package.json`, `package-lock.json`, `CHANGELOG.md`, `README.md`, `README_CN.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/DOCUMENTATION_MANIFEST.md`.
- No new runtime dependency, persistent cache, or Git history operation.
