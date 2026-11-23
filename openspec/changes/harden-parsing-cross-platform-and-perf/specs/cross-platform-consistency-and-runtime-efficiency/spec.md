# Spec Delta

## Purpose

Ensure consistent filesystem path handling across Windows and POSIX platforms, eliminate redundant cache and logging overhead on hot paths, and enforce automated cross-platform CI verification.

## ADDED Requirements

### Requirement: Filesystem path keys and watcher exclusions normalize platform casing consistently
On case-insensitive Windows filesystems (`win32`), endpoint cache file lookups, scan state records, per-file version tokens, project configuration maps, and watcher scope/exclusion matching SHALL treat paths differing only in drive-letter or segment casing as the same file while preserving display paths.

#### Scenario: Watcher event differs in Windows drive-letter casing from initial scan
- **WHEN** a file on Windows is indexed under `F:\repo\src\UserController.java` and a subsequent update or delete event arrives as `f:\repo\src\UserController.java`
- **THEN** the endpoint cache and scan state update or remove the existing file entry in place without leaving duplicate or stale endpoints

### Requirement: Search and cache hot paths avoid redundant index maintenance and log output
Interactive search queries SHALL read result limits without emitting `INFO` log lines on every keystroke, and `EndpointCache` SHALL maintain file-keyed and flat endpoint structures without duplicating write-only path-bucket indexes.

#### Scenario: Typing in the endpoint search QuickPick
- **WHEN** a user types multiple characters in `Search REST Endpoints`
- **THEN** search filtering applies the configured `maxResults` without writing `Effective scan config` log entries to the OutputChannel on each filter pass

### Requirement: Automated test suite and CI pass across Linux and Windows
Unit tests and batch verification scripts SHALL use platform-consistent path construction so `npm test` passes on both POSIX and Windows environments, backed by a GitHub Actions CI workflow triggered on pushes and pull requests.

#### Scenario: Running unit tests on Windows and Ubuntu
- **WHEN** `npm test` and batch verification scripts run on `windows-latest` and `ubuntu-latest`
- **THEN** `ConfigManager` and all other Mocha/script suites pass without drive-letter or separator mismatches, and `publish.yml` + `ci.yml` execute the complete verification set including JSON-to-DTO batch tests
