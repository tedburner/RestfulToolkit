# JSON → Java/Kotlin Class DTO Generator Design

**Date**: 2026-05-08
**Status**: Approved

## Overview

Add a feature to generate Java/Kotlin DTO class files from JSON input. Users copy JSON to clipboard (or select in editor), trigger the command, choose language (Java/Kotlin), enter class name and package, and a new `.java`/`.kt` file is generated with proper structure, Jackson `@JsonProperty` annotations, and nested internal classes.

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/commands/JsonToClassCommand.ts` | VS Code command entry point (clipboard → input → generate → save) |
| `src/generator/JsonClassGenerator.ts` | Core generator: JSON parse → analyze → render |
| `src/generator/JsonTypeMapper.ts` | JSON value type → Java/Kotlin type mapping |
| `src/test/JsonClassGenerator.test.ts` | Unit tests for the generator |

### Modified Files

| File | Change |
|------|--------|
| `src/extension.ts` | Register new command |
| `package.json` | Add command registration (command palette + context menu) |
| `src/extractor/NameTransformer.ts` | Add `toPascalCase` function |
| `src/extractor/i18n.ts` | Add UI labels for the new feature |

### Dependencies (Reused)

- `NameTransformer.toCamelCase()` / `toSnakeCase()` — existing
- `NameTransformer.toPascalCase()` — new addition
- `i18n` labels — extended

## Component Design

### JsonClassGenerator

**ClassDef structure**:
```typescript
interface ClassDef {
    name: string;
    fields: FieldDef[];
}

interface FieldDef {
    name: string;        // camelCase Java field name
    jsonKey: string;     // original JSON key (for @JsonProperty)
    type: string;        // Java/Kotlin type (String, Long, List<User>, etc.)
    isNested: boolean;   // whether this field is a nested object
    nestedClass?: ClassDef; // the nested class definition
}
```

**Core methods**:

1. `parse(json: string): ClassDef[]` — Parse JSON, analyze structure, return root class + nested classes
2. `renderJava(root: ClassDef, className: string, packageName: string): string` — Generate Java source
3. `renderKotlin(root: ClassDef, className: string, packageName: string): string` — Generate Kotlin source

### JsonTypeMapper

Maps JSON value types to Java/Kotlin types:

| JSON Value | Java Type | Kotlin Type |
|------------|-----------|-------------|
| `"string"` | `String` | `String` |
| `123` (integer) | `Long` | `Long` |
| `12.34` (float) | `Double` | `Double` |
| `true/false` | `Boolean` | `Boolean` |
| `null` | `Object` | `Any?` |
| `[]` (array) | `List<T>` | `List<T>` |
| `{}` (object) | nested class name | nested class name |

### JsonToClassCommand

**Interaction flow**:

1. Read clipboard content (or editor selection)
2. If empty → error "请先复制 JSON 到剪贴板"
3. Try `JSON.parse()` → if fails, error "剪贴板内容不是有效 JSON"
4. QuickPick: select target language [Java / Kotlin]
5. InputBox: enter class name (prefilled with auto-inferred PascalCase name)
6. InputBox: enter package name (prefilled with "com.example.dto")
7. `JsonClassGenerator.generate(json, className, packageName, language)`
8. Save file dialog → write generated code → open editor

**Error handling**:
- Invalid JSON → show error with parse position
- Empty JSON object/array → warn but still generate (empty class)
- Clipboard empty → show hint

### Code Templates

**Java output** (example for `{ "user_name": "test", "age": 25 }`):

```java
package com.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class UserDto {

    @JsonProperty("user_name")
    private String userName;

    @JsonProperty("age")
    private Long age;

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public Long getAge() {
        return age;
    }

    public void setAge(Long age) {
        this.age = age;
    }
}
```

**Kotlin output** (same JSON):

```kotlin
package com.example.dto

import com.fasterxml.jackson.annotation.JsonProperty

data class UserDto(
    @JsonProperty("user_name")
    val userName: String,
    @JsonProperty("age")
    val age: Long
)
```

**Nested object** (Java):

```java
public class OrderDto {

    @JsonProperty("user")
    private User user;

    // ... getters/setters for user

    public static class User {
        @JsonProperty("user_name")
        private String userName;

        // ... getters/setters
    }
}
```

## Testing Strategy

### Unit Tests (`src/test/JsonClassGenerator.test.ts`)

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Simple object | `{ "name": "test" }` | Single class with String field |
| Nested object | `{ "user": { "name": "test" } }` | Outer class + inner static class |
| Array of objects | `{ "items": [{ "id": 1 }] }` | `List<Item>` + nested Item class |
| Null values | `{ "data": null }` | `Object` / `Any?` type |
| Mixed types | Complex nested JSON | Correct type mapping at all levels |
| Empty object | `{}` | Empty class (valid but no fields) |
| Invalid JSON | `{ broken }` | Error thrown |
| Kotlin data class | Any valid JSON | data class syntax with val |
| Getters/Setters (Java) | Any valid JSON | getter + setter per field |

### Manual Testing

- F5 debug session with real API response JSON
- Test command palette trigger
- Test context menu trigger
- Test editor selection trigger

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| JSON with very deep nesting | Limit to 3 levels, use `Object`/`Any?` for deeper |
| JSON array at root level | Wrap in a `RootItem` class or use plural name |
| Special characters in JSON keys | Sanitize to valid Java identifiers |
| Very large JSON payloads | Set reasonable size limit (~50KB) |
