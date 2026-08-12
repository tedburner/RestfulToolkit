## ADDED Requirements

### Requirement: Production-code simplification preserves observable extension behavior
The extension SHALL preserve all existing observable behavior when duplicated private production-code control flow is consolidated.

#### Scenario: File scanning remains behaviorally equivalent
- **WHEN** the extension performs normal, failed, changed-file, deleted-file, or queued forced scans
- **THEN** endpoint-cache replacement, scan state, refresh queuing, concurrency behavior, and user-visible scan progress remain compatible with the pre-refactor behavior

#### Scenario: Base URL resolution remains behaviorally equivalent
- **WHEN** the extension resolves base URLs from settings, project configuration, or Spring configuration files and those files change
- **THEN** precedence, placeholder resolution, profile overrides, in-memory cache invalidation, and returned base URLs remain compatible with the pre-refactor behavior

#### Scenario: Extension lifecycle remains behaviorally equivalent
- **WHEN** the extension activates or deactivates while configuration reloads or scans are active
- **THEN** commands remain registered, background work follows the existing lifecycle, and all subscriptions and timers are released without changing shutdown semantics

### Requirement: Endpoint search contract remains frozen during simplification
The extension SHALL preserve endpoint-search matching, filtering, scoring, stable ordering, result limits, and returned endpoint data while this simplification change is applied.

#### Scenario: Existing endpoint queries return compatible results
- **WHEN** a user searches with exact, substring, acronym, fuzzy, multi-token, repeated-token, or HTTP-method queries and optional filters
- **THEN** the result membership, order, and result-limit behavior remain compatible with the established endpoint-search tests
