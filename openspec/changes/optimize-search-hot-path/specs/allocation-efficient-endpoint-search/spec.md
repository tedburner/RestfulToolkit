## ADDED Requirements

### Requirement: Search hot path preserves matching and ranking semantics
The system SHALL return the same endpoints in the same order for the same in-memory endpoint set, query, filters, and result limit while reducing intermediate score aggregation work in the search hot path.

#### Scenario: Existing matching modes remain available
- **WHEN** a query uses exact, substring, word-boundary, acronym, fuzzy, HTTP-method, or multi-token matching
- **THEN** the returned endpoints and their order match the established scoring contract

#### Scenario: Repeated query tokens are canonicalized
- **WHEN** a query repeats the same non-HTTP token with different letter casing
- **THEN** the returned endpoints and their order equal the query with one normalized occurrence of that token

#### Scenario: Broad search keeps result limits and stable ties
- **WHEN** a broad query matches more endpoints than `maxResults`
- **THEN** the system returns at most `maxResults` endpoints in the same stable rank order as the established scoring contract
