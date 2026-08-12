## Context

Endpoint search already precomputes lowercase text, segments, and acronyms and uses a stable bounded heap. Its hot path still allocates one `MatchScore` per text token and repeatedly maps those scores to calculate totals and field maxima.

## Goals / Non-Goals

**Goals:**

- Preserve all current matching modes, filters, result limits, scores, and stable ordering.
- Reduce per-query temporary score aggregation work.
- Prove compatibility with deterministic search corpus tests and preserve broad-search coverage.

**Non-Goals:**

- No inverted index, query-result cache, dependency, configuration, or persistence change.
- No modification to fuzzy-match thresholds, scoring weights, query syntax, or QuickPick behavior.
- No performance claim without a repeatable benchmark-style test.

## Decisions

### Stream score aggregation

`search()` will aggregate each text token immediately. A non-matching token exits the candidate early; matching tokens update the total and four maxima without allocating `tokenScores` or repeatedly mapping it.

This preserves the existing formula: average token total and maximum field score. A new allocation-free helper is preferred to an index because it changes only the implementation, not candidate selection or ranking semantics.

### Canonicalize query tokens

Repeated non-HTTP tokens will be removed after lowercasing. Repetition currently leaves the arithmetic mean unchanged, so deduplication is behavior-preserving. HTTP token parsing remains unchanged.

### Compatibility-first validation

Tests will compare the optimized search to a test-local reference implementation of the prior scoring flow across exact, substring, boundary, acronym, fuzzy, multi-token, HTTP-filter, and tie-order cases. A broad synthetic corpus will also exercise the hot path without asserting environment-dependent wall-clock timings.

## Risks / Trade-offs

- [A streamed aggregation changes a score formula by accident] → Reference-equivalence tests cover every matching mode and stable ordering.
- [Token deduplication changes repeated-token ranking] → Add a regression scenario that compares repeated and unique-token queries.
- [Microbenchmark timings vary by host] → Assert deterministic output and execute the corpus repeatedly; record timing only as diagnostic output.
