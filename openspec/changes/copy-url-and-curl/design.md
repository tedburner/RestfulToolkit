## Context

当前 Copy 命令走 `ParameterExtractor`，它从编辑器中实时解析当前方法所在的端点信息。但存在两个缺失：
1. 只提取了方法级路径（如 `/users/{id}`），没有拼接类级路径（如 `@RequestMapping("/api")`）。
2. 没有 Base URL 概念，无法生成完整 URL。
3. 没有解析 `@RequestHeader` / `@HeaderParam`，缺少请求头信息。

扫描器（`SpringMvcParser` / `JaxRsParser`）在扫描阶段已经正确拼接了类级 + 方法级路径，`RestEndpoint.path` 是完整路径。但 Copy 命令不经过扫描器，走的是一条独立的实时解析路径。

## Goals / Non-Goals

**Goals:**
- 右键菜单提供三个独立命令：Copy Full URL、Copy as cURL、Copy Parameters（已有）
- Copy Full URL 输出完整 URL：`http://host:port/class-path/method-path?query=`
- Copy as cURL 输出可被 Postman/Bruno/Insomnia 直接导入的 cURL 命令
- Base URL 支持三级回退：用户配置 → application.yml 自动检测 → 默认值
- 新增 header 参数类型，解析 `@RequestHeader` / `@HeaderParam`

**Non-Goals:**
- 不做路径参数交互式替换（保留 `{placeholder}` 形式）
- 不做复杂 application.yml 解析（多 Profile、占位符嵌套等跳过）
- 不修改现有 Copy Parameters 的行为
- 不做 JAX-RS `@ApplicationPath` 自动检测（首版只支持 Spring 自动检测）

## Decisions

### 1. 类级路径拼接方式

**决策**：在 `ParameterExtractor.findMethodAtPosition` 中向前搜索类级别的 `@RequestMapping` / `@Path`，自行拼接。

**理由**：不引入对扫描器的依赖，Copy 命令保持独立、即时可用。扫描器需要在文件扫描完成后才有数据，而 Copy 是实时操作。

**拼接逻辑**：
```
classPath = 提取 @RequestMapping(value="/api") 或 @Path("/api")
methodPath = 提取方法级注解路径
fullPath = classPath + methodPath  （去掉 classPath 尾部 / 和 methodPath 首部 / 的重复）
```

### 2. Base URL 回退链

**决策**：实现 `BaseUrlResolver` 类，三级回退。

```
优先级：
1. VS Code 设置 restfulToolkit.baseUrl
2. 项目 .restful-toolkit.json 中的 baseUrl
3. 自动检测 application.yml（只读 server.port + server.servlet.context-path）
4. 默认 "http://localhost:8080"
```

自动检测采用最小可行方案：正则匹配 `server.port:\s*(\d+)` 和 `server.servlet.context-path:\s*(.+)`，只接受纯值（不含 `${}` 占位符）。

### 3. EndpointParameter 新增 header 类型

**决策**：`source` 字段从 `'path' | 'query' | 'body' | 'form'` 扩展为 `'path' | 'query' | 'body' | 'form' | 'header'`。

在 `SpringParameterParser` 的注解列表中增加 `RequestHeader`，映射 source 为 `header`。
在 `JaxRsParameterParser` 的注解列表中 `HeaderParam` 的 source 从 `query` 改为 `header`。

### 4. cURL 生成策略

**决策**：新建 `CurlConverter` 类，接收 `EndpointCopyInfo` 输出 cURL 字符串。

生成规则：
- GET/DELETE：不拼接 `-d` body，URL 上拼接查询参数
- POST/PUT/PATCH：根据 contentType 选择 `-d`（JSON）或 `-F`（FormData）或 `-d`（urlencoded）
- Headers：每个 header 一行 `-H 'Key: Value'`
- Body JSON 使用单行格式（Postman 导入兼容性最好）

### 5. 命令注册方式

**决策**：在 `CopyEndpointParametersCommand` 中新增两个方法 `copyFullUrl()` 和 `copyAsCurl()`，分别注册为独立的 VS Code command。右键菜单在 `package.json` 的 `menus.editor/context` 中新增两个 entry。

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| 类级路径正则匹配失败（多行注解、变量引用） | 保留 fallback：匹配不到类级路径时只用方法级路径 |
| application.yml 自动检测不准确 | 只读最简形式，复杂情况静默跳过，用户可手动配置 |
| cURL 输出格式在个别工具中解析异常 | 使用最标准的 cURL 语法，避免 shell 特殊字符 |
| JAX-RS `@ApplicationPath` 未自动检测 | JAX-RS 用户手动配置 baseUrl 作为 workaround |
