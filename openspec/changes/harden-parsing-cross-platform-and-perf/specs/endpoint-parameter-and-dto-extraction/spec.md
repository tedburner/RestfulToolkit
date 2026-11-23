# Spec Delta

## Purpose

Provide accurate endpoint method location, multi-line route/content-type extraction, Spring and JAX-RS parameter parsing, and DTO/record field expansion for all editor copy commands (`Copy Endpoint Parameters`, `Copy Full URL`, and `Copy as cURL`).

## ADDED Requirements

### Requirement: Editor copy commands resolve enclosing direct member methods structurally
When invoked from an active Java or Kotlin editor, copy commands SHALL resolve the enclosing class/interface/object direct member method and its complete preceding annotation block regardless of multi-line formatting, array or generic return types, or method calls inside the method body.

#### Scenario: Multi-line mapping annotation specifies consumes media type
- **WHEN** a user invokes `Copy as cURL` or `Copy Endpoint Parameters` on a method whose `@PostMapping` or `@RequestMapping` spans multiple lines and declares `consumes = MediaType.MULTIPART_FORM_DATA_VALUE` or `APPLICATION_FORM_URLENCODED_VALUE`
- **THEN** the extracted `contentType` reflects the declared media type (`form-data` or `x-www-form-urlencoded`) rather than defaulting to `json`

#### Scenario: Endpoint method returns an array or generic type
- **WHEN** a user invokes a copy command on a controller method returning an array type (such as `byte[]` or `String[]`) or generic type (such as `Map<String, Object>` or Kotlin `fun <T>`)
- **THEN** the command resolves that method rather than walking upward into an adjacent method

#### Scenario: Cursor is placed on a return, throw, or constructor call inside a method body
- **WHEN** a user invokes a copy command while the cursor is on a statement such as `return fetchBytes(id);`, `throw badRequest(msg);`, or `new HashMap()` inside an endpoint method body
- **THEN** the command resolves the enclosing endpoint method and its parameters instead of treating the statement as a method declaration

### Requirement: Parameter parsers support standard annotation attributes, coexisting annotations, and array/generic types
Parameter extraction SHALL recognize Spring `name` and `value` attributes, tolerate validation or metadata annotations placed before or after parameter binding annotations, and extract complete Java/Kotlin parameter types and variable names.

#### Scenario: Spring parameter uses name attribute
- **WHEN** a parameter is annotated with `@RequestParam(name = "user_id", required = false) Long userId` (or equivalent `@PathVariable`, `@RequestHeader`, `@RequestPart`)
- **THEN** the extracted parameter name is `user_id`

#### Scenario: Validation annotations precede or follow binding annotations
- **WHEN** a parameter is declared as `@RequestBody @Valid UserDto dto` or `@RequestParam(required = false) @NotBlank String keyword`
- **THEN** the parameter binding annotation, parameter name (`dto` / `keyword`), and parameter type (`UserDto` / `String`) are extracted without dropping the parameter or mistaking the validation annotation for the type

#### Scenario: Array and multi-argument generic parameter types
- **WHEN** a parameter uses an array type (`@RequestParam String[] ids`, `@RequestPart("file") byte[] data`) or multi-argument generic type (`@RequestBody Map<String, Object> payload`)
- **THEN** the extracted parameter preserves the variable name (`ids`, `data`, `payload`) and full parameter type

### Requirement: DTO expansion excludes non-serialized fields, supports Java records, and honors workspace exclusions
DTO field extraction SHALL omit `static`, `transient`, and `@JsonIgnore` fields, extract components from Java `record` types and multi-attribute `@JsonProperty` annotations, apply valid brace-grouped glob exclusions during DTO file lookup, and expand sibling nested DTO fields without cross-branch interference.

#### Scenario: Serializable DTO with static constants and ignored fields
- **WHEN** a Java DTO declares `private static final long serialVersionUID = 1L;`, `transient` fields, or `@JsonIgnore` fields alongside instance properties
- **THEN** only serializable instance properties appear in expanded JSON/form output

#### Scenario: Java record used as request body DTO
- **WHEN** a controller `@RequestBody` parameter references a Java `record` (such as `public record CreateUserRequest(@JsonProperty(value = "user_name", required = true) String userName, Integer age) {}`)
- **THEN** DTO expansion extracts `user_name` and `age` (including nested DTO components up to the configured depth limit)

#### Scenario: DTO file lookup excludes build outputs
- **WHEN** the workspace contains generated or compiled copies under excluded directories (`target`, `build`, `node_modules`, `src/test`, or configured `excludePaths`)
- **THEN** DTO file discovery excludes those directories using valid glob grouping
