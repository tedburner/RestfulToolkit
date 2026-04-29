## ADDED Requirements

### Requirement: Spring 请求头参数解析
系统 SHALL 解析 Spring Controller 方法中的 `@RequestHeader` 注解，提取请求头参数。

#### Scenario: 显式指定请求头名称
- **WHEN** 方法参数标注为 `@RequestHeader("X-Api-Key") String apiKey`
- **THEN** 提取的参数 SHALL 具有 `name: "X-Api-Key"`、`source: "header"`、`type: "String"`

#### Scenario: 请求头含默认值
- **WHEN** 方法参数标注为 `@RequestHeader(value = "Accept", defaultValue = "application/json") String accept`
- **THEN** 提取的参数 SHALL 具有 `isRequired: false` 和 `defaultValue: "application/json"`

### Requirement: JAX-RS 请求头参数解析
系统 SHALL 解析 JAX-RS Resource 方法中的 `@HeaderParam` 注解，提取请求头参数。

#### Scenario: JAX-RS 请求头参数
- **WHEN** 方法参数标注为 `@HeaderParam("Authorization") String auth`
- **THEN** 提取的参数 SHALL 具有 `name: "Authorization"`、`source: "header"`、`type: "String"`

### Requirement: 请求头参数纳入 EndpointCopyInfo
系统 SHALL 将请求头参数包含在 `EndpointCopyInfo.parameters` 数组中，`source` 为 `"header"`。

#### Scenario: 混合参数类型
- **WHEN** 方法同时包含 `@PathVariable`、`@RequestParam`、`@RequestHeader` 和 `@RequestBody` 参数
- **THEN** 所有参数 SHALL 被正确提取，`source` 分别为 `path`、`query`、`header`、`body`
