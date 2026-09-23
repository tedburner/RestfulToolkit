## Purpose

Expand repeated sibling DTO fields independently while preventing unbounded recursion when DTO types refer back to an ancestor.

## ADDED Requirements

### Requirement: Cycle detection is local to the active DTO path
DTO expansion SHALL allow the same type in separate sibling branches and stop expanding a type already present on the current ancestor path.

#### Scenario: Sibling fields share a DTO type
- **WHEN** two fields in one DTO refer to the same nested DTO type
- **THEN** both fields receive the nested DTO fields

#### Scenario: DTO types form a cycle
- **WHEN** a nested DTO refers to a type already being expanded on the current branch
- **THEN** expansion stops at that cycle without unbounded recursion
