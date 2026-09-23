## Purpose

Keep endpoint metadata consistent between workspace search and editor copy commands, including supported Spring routes without a method path and declarations without explicit Java visibility.

## ADDED Requirements

### Requirement: Copy commands use parsed endpoint route metadata
The extension SHALL derive route path and HTTP method for copy commands from the same annotation parsing rules used by endpoint indexing.

#### Scenario: Spring method mapping has no explicit path
- **WHEN** a supported Spring mapping annotation has no path and is attached to a method
- **THEN** the indexed endpoint uses the class path, or `/` when no class path exists
- **AND** copy commands use the same path and HTTP method

#### Scenario: Method declaration has no visibility modifier
- **WHEN** a Java method uses package-private visibility or a supported Kotlin method declaration is selected
- **THEN** the editor copy flow locates the method and derives its parsed route metadata

### Requirement: Copy metadata reflects current editor content
Copy commands SHALL parse the active document text so unsaved route edits are reflected in copied URLs and cURL commands.

#### Scenario: Unsaved route annotation is edited
- **WHEN** the active document contains unsaved supported route metadata
- **THEN** the copied route uses the active document's current parsed metadata
