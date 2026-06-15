# RestfulToolkit Optimization Task List

Last updated: 2026-06-15

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
| OPT-004 | P2 | `BaseUrlResolver` | Done 2026-06-13 | Cache resolved base URL per workspace folder with config-file invalidation | `npm test` includes sync/async cache hit and invalidation coverage |
| OPT-005 | P2 | `EndpointCache` | Done 2026-06-13 | Precompute searchable fields and use bounded top-K selection for large endpoint sets | `npm test` includes ranking coverage and precomputed-field reuse coverage |
| OPT-006 | P3 | `TextProcessor` | Reviewed 2026-06-13 | Review memory allocation only if profiling shows sanitizer pressure | Existing sanitizer length/line-mapping tests; no safe code change without profiling |
| OPT-007 | P3 | Parser cleanup | Done 2026-06-13 | Remove redundant parser branches and obsolete diagnostic comments while preserving behavior | Parser unit tests |

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
- Used collected Spring config file paths, mtimes, ctimes, and sizes as the invalidation signature.
- Shared the cache across sync and async resolver instances while keeping it process-local only.
- Returned cloned cache values so callers cannot mutate shared cache state.
- Added sync and async regression tests for cache hits, plus config-change invalidation tests including same-size rewrites with unchanged mtimes.

### OPT-005: EndpointCache Search Precomputation And Top-K Selection

Implemented on 2026-06-13.

- Stored internal searchable endpoint entries while preserving the public `RestEndpoint` API.
- Cloned endpoints at cache boundaries so caller mutation cannot desynchronize returned values from precomputed search fields.
- Precomputed lower-case text, camelCase/separator words, and acronyms when endpoints are added.
- Reused precomputed searchable fields during search instead of re-tokenizing endpoint text for every query.
- Maintained only the best `maxResults` scored candidates during search, avoiding a full sort of every match.
- Added regression coverage that fails if search falls back to runtime endpoint tokenization.

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

## Recommended Next Step

All listed optimization tasks are complete. Add new tasks only after a fresh profiling or review pass identifies the next bottleneck.
