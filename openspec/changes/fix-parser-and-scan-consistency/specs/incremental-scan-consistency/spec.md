## ADDED Requirements

### Requirement: Successful scans update endpoint and scan state together
The scanner SHALL update the in-memory scan record after every successful workspace or watcher-triggered file scan.

#### Scenario: Watcher-triggered file change
- **WHEN** a watched source file is changed and successfully rescanned
- **THEN** its endpoint cache and scan record contain the new endpoint count and current file metadata

#### Scenario: File changes while it is being parsed
- **WHEN** a source file's modification time or size differs between the metadata reads before and after parsing
- **THEN** the scanner keeps the previous endpoint cache, removes any successful scan record for that result, and leaves the file eligible for retry

### Requirement: Incremental changes use modification time and size
The scan state manager SHALL request a rescan when either the current file modification time or size differs from the last successful scan record.

#### Scenario: Same modification time with changed size
- **WHEN** a file has the recorded modification time but a different size
- **THEN** the file is selected for rescanning

#### Scenario: Modification time moves backwards
- **WHEN** a restored or checked-out file has a modification time different from the recorded value
- **THEN** the file is selected for rescanning

### Requirement: Deletion removes all in-memory state
The scanner SHALL remove a deleted file from the endpoint cache, pending debounce timers, and scan records.

#### Scenario: Watched file is deleted
- **WHEN** a previously scanned source file is deleted
- **THEN** it no longer contributes endpoints or scan statistics

### Requirement: Scan state remains memory-only
The scan state manager SHALL NOT persist scan records to workspace or local storage.

#### Scenario: Extension restarts
- **WHEN** a new extension session begins
- **THEN** no scan records are loaded from a previous session
