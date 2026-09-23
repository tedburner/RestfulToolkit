## Purpose

Resolve project settings and runtime behavior against the workspace folder that owns a resource, while preserving merged scan patterns for whole-workspace scans.

## ADDED Requirements

### Requirement: Resource settings use the owning workspace folder
The extension SHALL resolve scalar project settings and scoped VS Code settings in the workspace folder containing the active resource.

#### Scenario: Multi-root resource has a project Base URL
- **WHEN** a copy command runs for a resource in a workspace folder with a configured Base URL
- **THEN** it uses that folder's Base URL rather than another folder's value

#### Scenario: Search result limit comes from project configuration
- **WHEN** a QuickPick is shown for an active resource
- **THEN** its result limit uses the resolved `maxResults` setting, including `.restful-toolkit.json`

### Requirement: Project configuration changes reload runtime settings
The extension SHALL reload project configuration and dependent watchers when a `.restful-toolkit.json` file is created, changed, or deleted.

#### Scenario: Project configuration changes
- **WHEN** a workspace project configuration file changes
- **THEN** the extension reloads configuration, rebuilds dependent watchers, and refreshes endpoint results
