## Why

The extension's core behavior is covered by regression tests, but several production modules have accumulated repeated lifecycle, configuration-discovery, and cleanup branches. Reducing that incidental complexity now makes future maintenance safer without changing endpoint discovery, search, configuration, or extension lifecycle behavior.

## What Changes

- Consolidate duplicated private control-flow in file scanning, Base URL resolution, and extension lifecycle handling.
- Improve local naming and helper boundaries where they make existing invariants easier to read and test.
- Keep `EndpointCache` search matching, ranking, HTTP filtering, bounded-heap ordering, and result limits unchanged; only allow local readability cleanup that has no behavioral effect.
- Add equivalence-focused regression coverage before refactoring each affected production module.

## Capabilities

### New Capabilities

- `behavior-preserving-code-simplification`: Safely reduce duplicated production-code control flow while preserving the extension's existing observable behavior.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/scanner/FileScanner.ts`, `src/utils/BaseUrlResolver.ts`, `src/extension.ts`, and only behavior-neutral local cleanup in `src/cache/EndpointCache.ts`.
- Affected tests: focused scanner, Base URL resolver, extension lifecycle, and endpoint-search regression tests.
- No commands, configuration keys, dependencies, storage, public API, or VS Code UI behavior changes.
