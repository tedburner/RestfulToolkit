## Context

The extension indexes endpoint metadata asynchronously but editor copy commands independently inspect annotations. Runtime settings are partly merged across workspace folders, parse exceptions can be hidden as empty results, and DTO traversal shares visited state across sibling branches.

## Goals / Non-Goals

### Goals
- Align indexed and copied route metadata.
- Preserve the last successful endpoint snapshot on parse failure.
- Resolve resource-specific settings from the owning workspace folder and reload project config changes.
- Correct DTO cycle tracking without weakening recursion limits.
- Release as v0.0.9 with synchronized documentation.

### Non-Goals
- Add inheritance-based endpoint discovery or new framework support.
- Change persistent storage or add runtime dependencies.
- Publish the extension or modify Git history.

## Decisions

- Add a structured parse outcome while retaining the existing endpoint-array parser API for callers that do not need failure details.
- Let the scanner commit only successful parse outcomes; successful empty parses remain authoritative and clear removed endpoints.
- Use the shared annotation parser on the current editor document and match the selected method to its parsed endpoint metadata.
- Add resource-aware configuration resolution for resource commands while keeping workspace-wide scan glob merging intact.
- Watch `.restful-toolkit.json` and perform the existing configuration reload/full-refresh path.
- Treat the DTO visited set as the active recursion path by removing a type after its branch completes.

## Risks / Trade-offs

- Matching a selected editor method to parser output must account for repeated method names; use method declaration position/route annotation line metadata where available.
- VS Code workspace configuration scopes differ between workspace folder and workspace-level settings; explicit user settings retain precedence over project configuration.
- Parsing the full editor text for a copy command adds work, but it occurs on demand and avoids stale file-system content for unsaved edits.

## Migration Plan

No migration is needed. Existing configuration files remain valid. Update package metadata and user-facing release docs to v0.0.9, then run compile, lint, unit tests, and documented automation scripts.

## Open Questions

None.
