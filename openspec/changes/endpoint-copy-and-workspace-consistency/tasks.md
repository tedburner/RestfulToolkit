## 1. Endpoint parsing and copy consistency
- [x] 1.1 Add regression coverage for pathless Spring routes, package-private methods, and Kotlin method selection.
- [x] 1.2 Reuse parsed endpoint metadata in editor copy commands and keep active document edits visible.

## 2. Scan failure safety
- [x] 2.1 Add explicit parse outcomes and ensure framework parse failures propagate to the file boundary.
- [x] 2.2 Add regression coverage proving failed parses preserve cached endpoints and successful empty parses clear them.

## 3. Workspace-scoped configuration and DTO recursion
- [x] 3.1 Resolve resource settings by workspace folder and route SearchUI result limits through ConfigManager.
- [x] 3.2 Reload configuration and refresh on `.restful-toolkit.json` events.
- [x] 3.3 Make DTO visited tracking path-local and verify siblings plus cycles.

## 4. Release verification and documentation
- [x] 4.1 Bump package and lockfile version to v0.0.9.
- [x] 4.2 Synchronize AGENTS.md, CHANGELOG, README files, CLAUDE.md, and documentation manifest.
- [x] 4.3 Run compile, lint, test suite, production build, and documented automation tests; resolve failures.
