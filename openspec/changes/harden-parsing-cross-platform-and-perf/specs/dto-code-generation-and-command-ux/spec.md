# Spec Delta

## Purpose

Guarantee syntactically valid Java and Kotlin DTO output for arbitrary JSON keys, honor user-configured parameter naming preferences and clear QuickPick labels, preserve Escape cancellation across multi-step prompts, and provide clear multi-root feedback when creating project configuration files.

## ADDED Requirements

### Requirement: JSON-to-DTO generation produces valid identifiers and clean imports for all JSON keys
When generating Java or Kotlin DTO classes from JSON, the generator SHALL produce valid, unique language identifiers even when JSON keys contain only symbols, underscores, or non-ASCII characters, while preserving the exact original key in `@JsonProperty` and omitting unused `java.util.List` imports in Java when no list field exists.

#### Scenario: JSON keys consist of symbols, underscores, or non-ASCII characters
- **WHEN** a user generates a Java or Kotlin DTO from JSON containing keys such as `"$"`, `"___"`, or `"中文"`
- **THEN** each field (and any nested class derived from such keys) receives a valid non-empty identifier (such as `field`, `field2`, or `NestedItem`) with `@JsonProperty` retaining the original key, and the generated source compiles cleanly

#### Scenario: Java DTO without array fields omits List import
- **WHEN** a user generates a Java DTO whose root and nested classes contain no `List<...>` fields
- **THEN** `import java.util.List;` is not emitted

### Requirement: Parameter copy honors explicit naming configuration and displays accurate default-format labels
`Copy Endpoint Parameters` SHALL apply `restfulToolkit.copyNameFormat` when explicitly configured by the user, fall back to underscore-ratio auto-detection when unconfigured, and display format icons plus a clear default/recommended indicator in the format QuickPick.

#### Scenario: User explicitly sets copyNameFormat to snake_case or camelCase
- **WHEN** `restfulToolkit.copyNameFormat` is explicitly configured in VS Code settings for the active resource
- **THEN** copied parameter and DTO field names follow the configured naming format (`snake_case` or `camelCase`)

#### Scenario: Format QuickPick indicates recommended format
- **WHEN** `Copy Endpoint Parameters` opens the format selection QuickPick
- **THEN** each option displays its format icon and the auto-detected option shows a recommended/default badge rather than the "Name Format" label

### Requirement: Multi-step command prompts respect cancellation and multi-root workspace selection
Interactive commands SHALL abort cleanly without side effects whenever a user dismisses a QuickPick or InputBox with Escape, and `Create Project Config File` SHALL support multi-root folder selection and notify the user when `.restful-toolkit.json` already exists.

#### Scenario: Pressing Escape on Lombok prompt cancels DTO generation
- **WHEN** a user selects `Java` in `Generate DTO Class from JSON` and presses Escape on the `Use Lombok` QuickPick
- **THEN** the command exits immediately without prompting for class/package names or writing any file

#### Scenario: Creating project config in multi-root workspace or when config exists
- **WHEN** a user runs `Create Project Config File` in a multi-root workspace or in a folder that already has `.restful-toolkit.json`
- **THEN** multi-root workspaces resolve the target folder via picker (or active editor context when unambiguous) and existing `.restful-toolkit.json` files trigger a visible notification instead of failing silently
