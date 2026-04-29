## 为什么

现有的"复制端点参数"功能仅输出参数模板（URL 参数、JSON Body、Form Data），用户无法直接从源代码复制完整的端点 URL 或可立即使用的 cURL 命令。这导致用户必须手动拼凑：Base URL + 路径 + 查询参数 + 请求头 + 请求体，然后才能粘贴到 Postman、Bruno 或 Insomnia 中使用。

## 变更内容

- **复制完整 URL**：新增右键菜单命令，复制完整的端点 URL（Base URL + 完整路径，路径参数保留 `{占位符}` 形式 + 拼接查询参数）。
- **复制为 cURL**：新增右键菜单命令，生成包含 HTTP 方法、URL、请求头（来自 `@RequestHeader` / `@HeaderParam`）和请求体（含 DTO 字段展开）的 cURL 命令。输出可直接导入 Postman、Bruno、Insomnia。
- **复制参数**：保留现有命令，行为不变。
- **Base URL 配置**：新增 `baseUrl` 配置项，回退链：用户配置 → 从 `application.yml` 自动检测 → 默认值 `http://localhost:8080`。
- **请求头参数支持**：端点参数解析扩展，支持识别 `@RequestHeader`（Spring）和 `@HeaderParam`（JAX-RS）。

## 能力

### 新增能力

- `url-copy`：完整 URL 生成，含 Base URL 解析、路径参数占位符保留、查询参数拼接。
- `curl-export`：cURL 命令生成，从端点元数据提取方法、URL、请求头、请求体。
- `base-url-config`：Base URL 配置系统，多源回退（用户配置 → 自动检测 → 默认值）。
- `header-parsing`：从 `@RequestHeader` / `@HeaderParam` 注解中提取请求头参数。

### 修改的能力

- *（无，全部为新增能力）*

## 影响

- **新增文件**：`CurlConverter.ts`、`BaseUrlResolver.ts`、更新 `package.json`（命令、配置 Schema）。
- **修改文件**：`types.ts`（`EndpointParameter` 新增 `header` 来源类型）、`ParameterExtractor.ts`（类级路径拼接、请求头解析）、`CopyEndpointParametersCommand.ts`（注册新命令）、`ScanConfig.ts`（新增 `baseUrl` 配置键）、`package.json`（配置属性）。
- **无破坏性变更**：现有命令和行为保持不变。
