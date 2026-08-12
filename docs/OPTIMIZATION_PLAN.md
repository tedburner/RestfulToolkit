# RestfulToolkit Optimization Task List

Last updated: 2026-07-29

This document tracks the current core-code optimization backlog. It replaces the older completed optimization plan so future work can proceed item by item without relying on stale status.

## Scope

- Keep cross-session incremental-scan persistence out of scope.
- Prefer low-risk optimizations with measurable behavior or regression tests.
- Preserve endpoint parsing correctness and search ranking semantics before chasing micro-optimizations.

## Task List

| ID | Priority | Area | Status | Goal | Verification |
|----|----------|------|--------|------|--------------|
| OPT-001 | P1 | `FileScanner` | Done 2026-06-10 | Deduplicate overlapping glob matches and limit `needsScan` filesystem stat concurrency | `npm test` includes `FileScanner` duplicate/concurrency coverage |
| OPT-002 | P1 | `SpringMvcParser` | Done 2026-06-11 | Replace repeated per-annotation scans with one combined method-annotation pass | `npm test` includes source-order coverage across Spring mapping annotation types |
| OPT-003 | P2 | `DtoFieldExtractor` | Done 2026-06-13 | Add command-lifecycle cache for DTO type lookup and parsed field results | `npm test` includes repeated DTO lookup/parse cache coverage |
| OPT-004 | P2 | `BaseUrlResolver` | Done 2026-06-13 | Cache resolved base URL per workspace folder with config-file invalidation | `npm test` includes async cache-hit and invalidation coverage |
| OPT-005 | P2 | `EndpointCache` | Done 2026-06-13 | Precompute searchable fields and use bounded top-K selection for large endpoint sets | `npm test` includes ranking coverage and precomputed-field reuse coverage |
| OPT-006 | P3 | `TextProcessor` | Reviewed 2026-06-13 | Review memory allocation only if profiling shows sanitizer pressure | Existing sanitizer length/line-mapping tests; no safe code change without profiling |
| OPT-007 | P3 | Parser cleanup | Done 2026-06-13 | Remove redundant parser branches and obsolete diagnostic comments while preserving behavior | Parser unit tests |
| OPT-008 | P1 | `FileScanner` / activation | Done 2026-06-30 | Register commands before background indexing, combine discovery, prefilter annotations, and use complete file replacement | Activation, scanner, watcher, and stale-endpoint regression tests |
| OPT-009 | P1 | `EndpointCache` / `SearchUI` | Done 2026-06-30 | Replace ordered top-K insertion with a stable bounded heap and cap QuickPick allocation | Reference-order, operation-count, and QuickPick limit tests |
| OPT-010 | P2 | `BaseUrlResolver` | Done 2026-06-30 | Reuse configuration discovery until workspace-scoped file events invalidate the process-local cache | Cache-hit and workspace-isolation tests |
| OPT-011 | P2 | Scan diagnostics | Done 2026-06-30 | Replace routine per-file logs with lifecycle summaries | Scanner and watcher regression suite |
| OPT-012 | P2 | `EndpointCache` | Done 2026-07-15 | Stream multi-token score aggregation and canonicalize repeated text tokens without changing search semantics | Full endpoint-search regression suite, repeated-token equivalence, and hot-path allocation guard |
| SIM-001 | P2 | `FileScanner` / `BaseUrlResolver` / activation | Done 2026-07-15 | Consolidate duplicated private lifecycle and config-merging control flow without changing observable behavior | Scanner, Base URL, activation, and full regression suites |
| OPT-013 | P1 | Scan/Base URL concurrency | Done 2026-07-01 | Preserve queued refreshes across failures, drain config reloads and active scans on shutdown, isolate status timers, and reject stale async cache writes | Scanner, activation-lifecycle, timer-ownership, and concurrent invalidation regression tests |
| OPT-014 | P1 | Spring/JAX-RS parsers | Done 2026-07-29 | Remove fixed declaration windows, isolate nested type ownership, and reuse a file-level line index | Long declarations, method-only class paths, nested controllers, and absolute-line regression tests |
| OPT-015 | P1 | Incremental scan state | Done 2026-07-29 | Keep workspace/watcher scan records consistent and compare real `mtime + size` metadata without persistence | ScanStateManager and FileScanner watcher/delete regression tests |
| OPT-016 | P2 | Base URL I/O | Done 2026-07-29 | Remove synchronous filesystem paths and narrow config watching to `main/resources` | Async BaseUrlResolver suite, activation watcher assertion, and URL/cURL automation |

## Completed Work

### OPT-001: FileScanner Candidate Deduplication And Bounded Stat Checks

Implemented on 2026-06-10.

- Deduplicated file candidates after all scan patterns are collected.
- Preserved per-pattern counts while logging the number of duplicate matches removed.
- Reused the scanner concurrency limit for incremental `needsScan` checks instead of launching unbounded stat calls.
- Made the concurrency helper generic so it can return ordered results.
- Added a `FileScanner` test that fails when duplicate glob results trigger duplicate scans or when `needsScan` exceeds the configured concurrency.

### OPT-002: SpringMvcParser Single-Pass Method Annotation Scan

Implemented on 2026-06-11.

- Replaced per-annotation-type loops with one combined Spring mapping annotation scan.
- Preserved source order across `@PostMapping`, `@GetMapping`, `@RequestMapping`, and other Spring mapping annotations.
- Reused the existing annotation extraction, class-level filtering, method lookup, and endpoint creation helpers.
- Added a parser regression test that fails when endpoints are returned by annotation type order instead of source order.

### OPT-003: DtoFieldExtractor Command-Lifecycle Cache

Implemented on 2026-06-13.

- Cached DTO file lookup results per `DtoFieldExtractor` instance.
- Cached sanitized DTO content and direct field parsing results by normalized file path.
- Cloned cached fields before nested DTO expansion so callers cannot mutate shared cache state.
- Preserved existing recursion depth, circular-reference protection, and parent FQN based file selection.
- Added a regression test that fails when repeated extraction re-runs `findFiles` or file reads for the same DTO graph.

### OPT-004: BaseUrlResolver Workspace Cache

Implemented on 2026-06-13.

- Cached resolved Base URL results by normalized workspace folder path.
- Invalidated the workspace-scoped cache from Spring configuration file events.
- Shared the cache across async resolver instances while keeping it process-local only.
- Returned cloned cache values so callers cannot mutate shared cache state.
- Added async regression tests for cache hits, workspace isolation, in-flight invalidation, and same-size content rewrites after invalidation.

### OPT-005: EndpointCache Search Precomputation And Top-K Selection

Implemented on 2026-06-13.

- Stored internal searchable endpoint entries while preserving the public `RestEndpoint` API.
- Cloned endpoints at cache boundaries so caller mutation cannot desynchronize returned values from precomputed search fields.
- Precomputed lower-case text, camelCase/separator words, and acronyms when endpoints are added.
- Reused precomputed searchable fields during search instead of re-tokenizing endpoint text for every query.
- Maintained only the best `maxResults` scored candidates during search, avoiding a full sort of every match.
- Added regression coverage that fails if search falls back to runtime endpoint tokenization.

### OPT-012: EndpointCache Search Hot Path

Implemented on 2026-07-15.

- Streamed multi-token score aggregation to remove intermediate token score arrays while preserving the existing average-total and per-field-maximum formula.
- Canonicalized repeated non-HTTP query tokens because repeated occurrences do not change the established score or rank.
- Added a regression guard for hot-path `map` allocations and repeated-token result equivalence; the full search suite continues to cover exact, substring, boundary, acronym, fuzzy, HTTP, multi-token, limit, and stable-order behavior.

### SIM-001: Behavior-Preserving Production-Code Simplification

Implemented on 2026-07-15.

- Consolidated FileScanner scan completion, status-bar timer scheduling, and per-file debounce cleanup helpers.
- Reused one BaseUrlResolver config-value merge and final-result conversion path before the remaining synchronous entry was removed in OPT-016.
- Consolidated extension configuration/workspace reload orchestration and subscription registration.
- Added regression coverage for pending debounce cancellation on file deletion and `application.yaml` parsing; endpoint-search behavior remains frozen.

### OPT-006: TextProcessor Allocation Review

Reviewed on 2026-06-13.

- Reviewed sanitizer and line-index code paths.
- Kept the current implementation because it already uses one linear pass and the existing tests assert strict length/line preservation.
- Deferred further allocation changes until a focused profile shows sanitizer pressure; speculative rewrites would add correctness risk around escaped strings and comments.

### OPT-007: Parser Cleanup

Implemented on 2026-06-13.

- Removed a duplicate unreachable `braceStart` check from `JaxRsParser`.
- Simplified `AnnotationParser` class-block brace tracking from a mutable wrapper object to a local counter.
- Preserved existing Spring/JAX-RS parser behavior and line-number tests.

### OPT-014 to OPT-016: Review Follow-up

Implemented on 2026-07-29.

- Scoped class-level Spring/JAX-RS paths to annotations before each type declaration, masked descendant types, and replaced fixed character windows with structural method-declaration scanning.
- Reused one file-level line index with absolute offsets so nested controller endpoints retain correct ownership and navigation lines.
- Unified successful workspace and watcher scans through one state-recording path; records use post-scan `mtime + size`, and deletion removes both endpoint and scan state.
- Removed deprecated/no-op scan-state code while keeping all state in Extension Host memory.
- Removed synchronous Base URL APIs and Node `fs` discovery/reads; runtime and tests use the VS Code asynchronous filesystem path.
- Narrowed the Base URL configuration watcher to `main/resources` application/bootstrap files.
- Kept `EndpointCache.removeByFile` and scanner concurrency constants unchanged: the former needs profiling before a higher-complexity storage model, and the latter is an internal safety limit rather than a user configuration contract.

## Recommended Next Step

All listed optimization tasks are complete. Add new tasks only after a fresh profile or review identifies a measurable bottleneck; do not replace the current in-memory model with local persistence.

## 2026-06-30 Follow-up Results

- Extension activation no longer waits for the initial scan; search exposes current partial results with a busy indicator.
- Source changes always replace the file endpoint set, including empty results, preventing stale endpoints.
- Multiple include globs use one discovery request, watcher exclusions are applied before debounce, and ordinary source files skip full parsing.
- Stable heap-based top-K reduced the local 50,000-endpoint / 1,000-result median sample from about 246 ms to about 48 ms; timing is diagnostic rather than a release guarantee.
- Base URL discovery is process-local and event-invalidated; no endpoint or configuration index is persisted to disk.
- Forced refreshes run after the active scan and survive a failed prior round; failed files are not marked successful, shutdown drains configuration reloads and any active scan, status hide timers cannot cross scan runs, and invalidated async Base URL results cannot repopulate cache.
