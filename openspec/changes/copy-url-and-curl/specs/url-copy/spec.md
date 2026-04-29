## ADDED Requirements

### Requirement: 完整 URL 生成
系统 SHALL 生成完整的端点 URL，由 Base URL、类级路径、方法级路径（路径参数保留占位符）和查询参数拼接而成。

#### Scenario: GET 端点含路径参数和查询参数
- **WHEN** 用户在 GET 端点 `@RequestMapping("/api")` + `@GetMapping("/users/{id}")`（含 `@RequestParam` 参数 `keyword`）上触发 Copy Full URL
- **THEN** 生成的 URL SHALL 为 `http://localhost:8080/api/users/{id}?keyword=`

#### Scenario: POST 端点无查询参数
- **WHEN** 用户在 POST 端点 `@PostMapping("/users")` 上触发 Copy Full URL，无查询参数
- **THEN** 生成的 URL SHALL 为 `http://localhost:8080/users`（不带尾部 `?`）

#### Scenario: 路径参数占位符保留
- **WHEN** 端点包含 `{userId}` 和 `{postId}` 等路径变量
- **THEN** 输出 URL 中占位符 SHALL 保持为 `{userId}` 和 `{postId}`，不替换为具体值

#### Scenario: 类级路径拼接
- **WHEN** Controller 同时有类级 `@RequestMapping("/api/v1")` 和方法级 `@GetMapping("/users")`
- **THEN** 生成的路径 SHALL 为 `/api/v1/users`，无重复斜杠
