## ADDED Requirements

### Requirement: Base URL discovery uses asynchronous filesystem access
Production code and repository tests SHALL use the asynchronous Base URL resolver and SHALL NOT expose or call a synchronous filesystem discovery path.

#### Scenario: Copy URL or cURL command resolves configuration
- **WHEN** a command requires an automatically detected Base URL
- **THEN** configuration directories and files are read through the VS Code asynchronous filesystem API

### Requirement: Configuration watcher matches resolver scope
The extension SHALL watch supported Spring configuration filenames only below directories matching `main/resources`, which is the same directory scope used by Base URL discovery.

#### Scenario: Configuration outside main resources changes
- **WHEN** a matching filename changes under an unrelated directory such as `node_modules`
- **THEN** the Base URL watcher does not subscribe to that path through its include pattern

#### Scenario: Supported resources configuration changes
- **WHEN** an application or bootstrap configuration changes under a module's `main/resources`
- **THEN** the corresponding workspace Base URL cache is invalidated
