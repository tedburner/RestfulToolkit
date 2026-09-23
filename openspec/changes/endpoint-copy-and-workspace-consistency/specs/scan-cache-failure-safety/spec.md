## Purpose

Preserve the last known good endpoint snapshot whenever reading or parsing a source file fails, while allowing a later successful parse, including an empty parse, to replace it.

## ADDED Requirements

### Requirement: Parsing reports failure explicitly
The parser SHALL distinguish successful parsing with zero endpoints from a parse failure.

#### Scenario: Parser throws while processing a file
- **WHEN** a framework parser fails for a source file
- **THEN** the file parse result reports failure rather than a successful partial or empty endpoint list

### Requirement: Failed scans preserve cached endpoints
The scanner SHALL update endpoint and successful-scan state only after the complete file parse succeeds and the file metadata remains stable.

#### Scenario: Previously indexed file cannot be parsed
- **WHEN** a file with cached endpoints fails to parse
- **THEN** its prior endpoint snapshot remains available
- **AND** the file remains eligible for a later retry

#### Scenario: Successful parse finds no endpoints
- **WHEN** a complete parse succeeds with no endpoints
- **THEN** the previous endpoints for that file are removed
