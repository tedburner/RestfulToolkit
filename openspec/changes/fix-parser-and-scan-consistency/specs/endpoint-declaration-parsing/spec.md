## ADDED Requirements

### Requirement: Class-level path annotations belong to the current type declaration
The parser SHALL treat a Spring `@RequestMapping` or JAX-RS `@Path` as a class-level path only when it belongs to the annotation region of the current class, interface, or object declaration.

#### Scenario: Spring class without a class-level mapping
- **WHEN** a Spring class contains only a method-level `@RequestMapping("/items")`
- **THEN** the endpoint path is `/items` and is not duplicated as `/items/items`

#### Scenario: JAX-RS class without a class-level path
- **WHEN** a JAX-RS class contains only a method-level `@Path("/items")`
- **THEN** the method path is applied exactly once

### Requirement: Nested types own only their direct endpoints
The parser SHALL parse each class independently and SHALL NOT attribute endpoints declared in a nested type to its enclosing type or vice versa.

#### Scenario: Nested controllers
- **WHEN** an outer controller and nested controller each declare one endpoint
- **THEN** exactly two endpoints are returned with their respective class names and class paths

### Requirement: Method declaration discovery has structural boundaries
The Spring parser SHALL discover a mapped method after any number of whitespace characters and supported annotations without relying on a fixed character window, and SHALL stop before crossing into another member.

#### Scenario: Long annotated method declaration
- **WHEN** more than 500 characters separate a mapping annotation from its mapped method declaration
- **THEN** the endpoint and method name are still detected

#### Scenario: Additional annotation with parameters
- **WHEN** a mapping annotation is followed by another parameterized annotation before the method
- **THEN** the additional annotation's parentheses are skipped and the mapped method name is returned

### Requirement: Endpoint line numbers remain absolute and accurate
The parser SHALL calculate endpoint line numbers from a single file-level line index and absolute character offsets.

#### Scenario: Multiple and nested types in one file
- **WHEN** endpoints are parsed from multiple top-level or nested types
- **THEN** every endpoint line points to its mapping annotation in the original file

#### Scenario: Identical JAX-RS annotation blocks
- **WHEN** multiple JAX-RS methods contain identical HTTP and path annotation text, including CRLF source files
- **THEN** every endpoint line points to its own HTTP annotation instead of the first identical block
