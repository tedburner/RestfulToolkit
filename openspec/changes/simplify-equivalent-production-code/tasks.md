## 1. Characterization Coverage

- [x] 1.1 Add or strengthen state-based regression coverage for FileScanner completion, failure, deletion, and queued forced-refresh behavior.
- [x] 1.2 Add or strengthen BaseUrlResolver coverage for precedence, cache hits, and create/change/delete invalidation behavior.
- [x] 1.3 Add extension lifecycle coverage for command registration, background startup, and deactivation cleanup; retain endpoint-search contract coverage.

## 2. Production-Code Simplification

- [x] 2.1 Consolidate duplicated private FileScanner lifecycle control flow while preserving ordering and failure semantics.
- [x] 2.2 Consolidate duplicated BaseUrlResolver discovery and cache-validation control flow while preserving resolution results.
- [x] 2.3 Consolidate extension reload orchestration and confirm EndpointCache remains untouched after contract regression verification.

## 3. Verification and Documentation

- [x] 3.1 Run focused tests after each refactor, then complete unit, endpoint, parameter-copy, URL/cURL, and JSON-to-DTO regression suites.
- [x] 3.2 Run lint, production build, strict OpenSpec validation, and diff whitespace checks.
- [x] 3.3 Synchronize Chinese project documentation and changelog with the completed behavior-preserving simplification.
