## Context

`FileScanner`, `BaseUrlResolver`, and the extension entry point each coordinate asynchronous lifecycle work with several early-return and cleanup branches. The current implementations are valid and covered by tests, but repeated local control flow increases the cost of reviewing later changes. `EndpointCache` was recently optimized; its observable search contract is intentionally frozen for this change.

## Goals / Non-Goals

**Goals:**

- Reduce duplicated private production-code control flow without changing externally observable behavior.
- Make lifecycle invariants explicit through narrowly scoped helpers and equivalence-focused tests.
- Preserve every existing configuration precedence, scan lifecycle, cache invalidation rule, command registration behavior, and endpoint-search result.

**Non-Goals:**

- No public API, command, setting, storage, dependency, or UI changes.
- No module split, class redesign, or broad formatting-only rewrite.
- No change to endpoint parsing, search scoring, ranking, filtering, QuickPick refresh behavior, scan concurrency, or shutdown timing.

## Decisions

### Refactor only private orchestration seams

Extract helpers only where they group an existing contiguous control-flow concern: scan completion/error cleanup, Base URL file selection or cache validation, and extension subscription/task disposal. Keep call ordering and data ownership in the current class.

Alternative considered: split each large class into new services. Rejected because it changes dependency boundaries and increases the regression surface without being necessary to remove local duplication.

### Tests define equivalence before each module changes

Add or strengthen state-based tests for the existing contract before each refactor. Tests assert observable results, event ordering, cache state, and disposal behavior rather than private helper calls.

Alternative considered: rely solely on the current full suite. Rejected because focused characterization tests make the unchanged behavior explicit at the point of refactoring.

### Freeze EndpointCache behavior

Only remove obviously redundant local expressions or improve private names if a direct equivalence test remains unchanged. Do not alter query token processing, score aggregation, heap retention, result cloning, or ordering.

Alternative considered: continue structural cleanup after the hot-path optimization. Rejected because combining maintenance refactoring with a recent performance-sensitive algorithm change obscures regression diagnosis.

## Risks / Trade-offs

- [A helper extraction changes asynchronous ordering] → Preserve call order, add focused lifecycle tests, and run scanner/extension regression suites after each module.
- [Cleanup consolidation disposes a resource too early or too late] → Test activation, background task settlement, and deactivation behavior with the existing VS Code mock.
- [Configuration refactoring changes precedence or stale-cache handling] → Cover application/bootstrap/profile precedence plus create/change/delete invalidation scenarios.
- [The diff becomes a style rewrite] → Restrict edits to duplicated branches and immediately adjacent names; stop when no clear duplication remains.

## Migration Plan

The extension has no persisted migration state. Ship the refactor as a normal patch after focused tests, the complete test suite, endpoint-regression scripts, production build, and strict OpenSpec validation pass. Rollback is a source rollback because no settings, storage format, or public contract changes.

## Open Questions

- None. The scope is deliberately limited to behavior-preserving private code consolidation.
