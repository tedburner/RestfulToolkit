## Why

`EndpointCache.search()` already avoids full-result sorting with a bounded heap, but it still creates temporary score collections and repeats normalization work for every candidate and every query token. This makes broad searches needlessly CPU- and allocation-heavy as endpoint counts grow.

## What Changes

- Stream per-token score aggregation without allocating intermediate score arrays.
- Deduplicate repeated non-HTTP query tokens without changing search semantics.
- Add compatibility and benchmark-style regression tests that compare optimized results with the current ranking contract.

## Capabilities

### New Capabilities

- `allocation-efficient-endpoint-search`: Preserve endpoint search results and stable ordering while reducing intermediate work in the in-memory search hot path.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/cache/EndpointCache.ts` and its unit tests.
- No command, configuration, dependency, storage, or external API changes.
- The extension remains fully in-memory; endpoint matching, filters, ranking, fuzzy matching, and result limits remain compatible.
