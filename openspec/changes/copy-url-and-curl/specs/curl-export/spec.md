## ADDED Requirements

### Requirement: cURL 命令生成
系统 SHALL 生成包含 HTTP 方法、完整 URL、请求头和请求体的 cURL 命令，格式需支持直接导入 Postman、Bruno、Insomnia。

#### Scenario: POST 端点含 JSON Body 和请求头
- **WHEN** 用户在 POST 端点上触发 Copy as cURL，端点含 `@RequestBody`、`@RequestHeader("X-Api-Key")` 和 `consumes = MediaType.APPLICATION_JSON_VALUE`
- **THEN** 输出 SHALL 包含 `-X POST`、完整 URL、`-H 'Content-Type: application/json'`、`-H 'X-Api-Key: '` 和 `-d '{...}'`（含展开的 DTO 字段）

#### Scenario: GET 端点含查询参数
- **WHEN** 用户在 GET 端点上触发 Copy as cURL，端点含 `@RequestParam` 参数
- **THEN** 输出 SHALL 为 `curl 'URL?param1=&param2='`，不含 `-d` 标志

#### Scenario: POST 端点含 Form Data
- **WHEN** 用户在 POST 端点上触发 Copy as cURL，端点含 `@ModelAttribute` 参数
- **THEN** 输出 SHALL 使用 `-F 'field1=' -F 'field2='` 标志

#### Scenario: POST 端点含 x-www-form-urlencoded
- **WHEN** 用户在 POST 端点上触发 Copy as cURL，端点含 `consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE`
- **THEN** 输出 SHALL 使用 `-H 'Content-Type: application/x-www-form-urlencoded'` 和 `-d 'field1=&field2='`

#### Scenario: cURL 输出可被 Postman 导入
- **WHEN** 生成的 cURL 命令粘贴到 Postman 的 Import → Raw Text
- **THEN** Postman SHALL 正确解析方法、URL、请求头和请求体

### Requirement: cURL Body 中 DTO 字段展开
系统 SHALL 在 cURL 输出中将 `@RequestBody` 和 `@ModelAttribute` 参数展开为其 DTO 字段，复用现有 DTO 提取逻辑（最多 3 层）。

#### Scenario: JSON Body 中嵌套 DTO
- **WHEN** `@RequestBody` 参数类型是含嵌套 DTO 字段的 DTO
- **THEN** `-d` Body SHALL 包含所有展开的字段，包括嵌套对象
