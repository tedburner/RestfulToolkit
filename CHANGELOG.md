# Changelog

All notable changes to RestfulToolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6] - 2026-06-02

- **Added**: Multi-word search with AND semantics — `post create` filters by HTTP method then ranks path matches first
- **Added**: CamelCase acronym search — `dtc` matches `DataTransferController`
- **Added**: CamelCase word boundary matching restored in endpoint search
- **Added**: Path-priority sorting — path matches always rank above method/class matches
- **Added**: `TextProcessor.sanitize({ preserveStrings: true })` option for DTO field extraction
- **Added**: `TextProcessor.buildPotentialFQNs` shared utility for cross-package import resolution
- **Added**: New test fixtures: `CommentComplexDto`, `SearchableResource`, `DataTransferController`
- **Added**: Node-based script mock for VS Code APIs so local validation scripts can run outside the Extension Host
- **Added**: Full i18n support for all user-facing strings (search, refresh, scan, Lombok prompt)
- **Fixed**: TypeScript compile failure caused by missing `TextProcessor` import in parameter extraction
- **Fixed**: Spring path parsing no longer drops class-level paths when `method` appears before `value`/`path`
- **Fixed**: Spring method annotations no longer treat `produces`/`consumes` strings as endpoint paths
- **Fixed**: JAX-RS parser ignores method signatures inside comments by matching signatures on sanitized text
- **Fixed**: Search queries with regex metacharacters no longer crash endpoint search
- **Fixed**: JSON-to-DTO generation escapes `@JsonProperty` keys and confirms before overwriting existing files
- **Fixed**: Project config parsing now validates field types and filters prototype pollution keys
- **Fixed**: Search UI now debounces input and refreshes live cache data when the query is cleared
- **Fixed**: File watchers rebuild after `restfulToolkit` configuration changes
- **Fixed**: Base URL YAML parsing no longer treats management `context-path` as server context path
- **Fixed**: Fully qualified Spring/JAX-RS REST annotations are now recognized
- **Fixed**: `@RequestMapping(method = {GET, POST})` and static-imported HTTP methods are parsed
- **Fixed**: Class-level Spring `@RequestMapping` detection now handles interfaces and long annotation gaps without creating duplicate method endpoints
- **Changed**: Endpoint cache uses flat array cache (`_allEndpoints`) and `_size` counter for O(1) access
- **Changed**: Base URL auto-detection now has an async VS Code filesystem path for Extension Host operations
- **Changed**: Project configuration now reloads across multi-root workspaces and workspace folder changes
- **Changed**: Extension shutdown resets runtime singletons for cleaner hot reloads and test isolation
- **Changed**: `maxResults` is clamped to 1-1000 and search filters are applied by `EndpointCache`
- **Changed**: Merged duplicate `buildFormDataBody`/`buildFormUrlencodedBody` into single `buildFormBody`
- **Changed**: Removed unused `resetForTest()` wrappers from singletons

---

- **新增**: 多词搜索 AND 语义 — `post create` 先过滤 HTTP 方法，再按 path 匹配优先排序
- **新增**: CamelCase 首字母缩写搜索 — `dtc` 匹配 `DataTransferController`
- **新增**: CamelCase 单词边界匹配恢复
- **新增**: 排序优先级 — path 匹配始终排在 method/class 匹配之前
- **新增**: `TextProcessor.sanitize({ preserveStrings: true })` 选项，用于 DTO 字段提取时保留字符串
- **新增**: `TextProcessor.buildPotentialFQNs` 共享工具，用于跨包 import 解析
- **新增**: 测试用例 `CommentComplexDto`、`SearchableResource`、`DataTransferController`
- **新增**: VS Code API 的 Node 脚本 mock，使本地验证脚本可脱离 Extension Host 运行
- **新增**: 全部用户可见字符串支持中英文 i18n（搜索、刷新、扫描、Lombok 选项）
- **修复**: 参数提取缺少 `TextProcessor` 导入导致 TypeScript 编译失败
- **修复**: Spring 类级路径在 `method` 位于 `value`/`path` 前时丢失
- **修复**: Spring 方法注解不再把 `produces`/`consumes` 字符串误识别为端点路径
- **修复**: JAX-RS 解析器在净化文本上匹配方法签名，忽略注释中的伪签名
- **修复**: 搜索输入正则元字符不再导致端点搜索崩溃
- **修复**: JSON 转 DTO 会转义 `@JsonProperty` key，并在覆盖同名文件前确认
- **修复**: 项目配置解析增加字段类型校验并过滤原型污染键
- **修复**: 搜索 UI 增加输入防抖，清空查询时使用实时缓存数据
- **修复**: `restfulToolkit` 配置变化后会重建文件监视器
- **修复**: Base URL YAML 解析不再把 management `context-path` 当成 server context path
- **修复**: 支持全限定名 Spring/JAX-RS REST 注解
- **修复**: 支持 `@RequestMapping(method = {GET, POST})` 与静态导入 HTTP 方法
- **优化**: 端点缓存使用扁平数组缓存（`_allEndpoints`）和 `_size` 计数器，O(1) 访问
- **优化**: `maxResults` 限制为 1-1000，`EndpointCache` 开始应用搜索过滤器
- **优化**: 合并重复的 `buildFormDataBody`/`buildFormUrlencodedBody` 为单一 `buildFormBody`
- **优化**: 移除未使用的 `resetForTest()` 包装方法

## [0.0.5] - 2026-05-19

- **Added**: Concurrent file scanning with 15 workers and throttled progress bar
- **Added**: `TextProcessor` utility for code sanitization, line index precomputation, and O(log N) line number lookup
- **Added**: Lombok option for JSON-to-DTO generation — `@Data` mode or auto-generate getter/setter
- **Changed**: Parsers use sanitized text for brace matching — eliminated false matches from string/annotation content
- **Changed**: Line number calculation upgraded from O(N) to O(log N) binary search
- **Changed**: All synchronous `fs` I/O replaced with async `vscode.workspace.fs` APIs
- **Changed**: Search ranking improved — exact word matches ranked higher, VS Code QuickPick built-in fuzzy matching removed
- **Changed**: Code cleanup — removed dead code, redundant imports, `CONFIG_KEYS` prefix, duplicate methods
- **Changed**: `EndpointCache.search` accepts `maxResults` parameter

---

- **新增**: 并发文件扫描（默认 15 并发）+ 进度条节流
- **新增**: `TextProcessor` 工具类：代码净化、换行符索引预计算、O(log N) 行号查找
- **新增**: JSON 转 DTO 支持 Lombok 选项 — 可选择 `@Data` 注解或自动生成 getter/setter
- **优化**: 解析器使用净化文本进行括号匹配，消除字符串/注释内容干扰
- **优化**: 行号计算升级为 O(log N) 二分查找
- **优化**: 同步文件操作替换为异步 API
- **优化**: 搜索排序：完整单词匹配优先，移除 QuickPick 内置模糊匹配
- **优化**: 代码清理：移除死代码、重复方法、简化配置
- **优化**: `EndpointCache.search` 接受 maxResults 参数

## [0.0.4] - 2026-04-29

- **Added**: Copy Full URL (Base URL + path + query params)
- **Added**: Copy as cURL (directly importable into Postman/Bruno/Insomnia)
- **Added**: `restfulToolkit.baseUrl` config with auto-detect from application.yml/properties
- **Added**: `@RequestHeader` / `@HeaderParam` support
- **Added**: Class-level path concatenation for copy commands
- **Fixed**: Method declaration location detection after closing brace of previous method
- **Fixed**: Parenthesis depth tracking in method signature extraction
- **Fixed**: Spring Cloud config file priority (application → bootstrap → application-{profile})

---

- **新增**: 复制完整 URL（Base URL + 路径 + 查询参数）
- **新增**: 复制为 cURL 命令（可直接导入 Postman/Bruno/Insomnia）
- **新增**: `restfulToolkit.baseUrl` 配置项，支持自动检测
- **新增**: `@RequestHeader` / `@HeaderParam` 请求头参数支持
- **新增**: 类级路径拼接
- **修复**: 方法声明定位修复
- **修复**: 方法签名提取括号深度跟踪
- **修复**: Spring Cloud 配置文件优先级

## [0.0.3] - 2026-04-27

- **Added**: Copy endpoint parameters in multiple formats: URL Params, JSON Body, Form Data, x-www-form-urlencoded
- **Added**: Nested DTO expansion (up to 3 levels) with @JsonProperty / @JsonAlias / @JSONField support
- **Added**: Auto format detection by HTTP method and parameter type
- **Added**: Naming convention auto-detection and toggle (camelCase / snake_case)
- **Added**: 75 batch tests covering Spring/JAX-RS parsing, DTO extraction, format conversion
- **Fixed**: Generic collection types (List\<T\>) failing to resolve nested DTO fields
- **Fixed**: Unhandled promise rejection in debounced scan setTimeout callback

---

- **新增**: 多种格式复制接口参数
- **新增**: 嵌套 DTO 展开（最多 3 层），支持 @JsonProperty / @JsonAlias / @JSONField
- **新增**: 根据 HTTP 方法和参数类型自动选择输出格式
- **新增**: 命名风格自动检测与切换（驼峰/蛇形）
- **新增**: 75 个批量测试
- **修复**: 泛型集合类型无法展开嵌套 DTO
- **修复**: 防抖扫描中 setTimeout 未捕获异常

## [0.0.2] - 2026-04-20

- **Added**: Multi-annotation support: non-REST annotations no longer block detection
- **Added**: Automated test suite with 49 endpoint validations, 100% line accuracy
- **Fixed**: Endpoint navigation jumps to annotation line instead of method definition line
- **Fixed**: Duplicate slash in class/method path concatenation
- **Fixed**: JAX-RS endpoint navigation to HTTP method annotation line

---

- **新增**: 多注解支持：非 REST 注解不再阻塞端点检测
- **新增**: 49 个端点自动化测试，行号准确性 100%
- **修复**: 端点跳转到注解行而非方法定义行
- **修复**: 路径拼接重复斜杠
- **修复**: JAX-RS 端点跳转到 HTTP 方法注解行

## [0.0.1] - 2026-04-19

- **Added**: Initial release: Spring MVC / JAX-RS endpoint scanning, fuzzy search, precise line number navigation
- **Added**: Java and Kotlin support, configurable scan paths and exclusion patterns

---

- **新增**: 初始版本：Spring MVC / JAX-RS 端点扫描、模糊搜索、精确行号跳转
- **新增**: 支持 Java 和 Kotlin，可配置扫描路径和排除模式

## [Unreleased]

- **Planned**: Micronaut / Quarkus support, Spring Boot Actuator integration
- **Planned**: HTTP request testing, Services tree view
- **Planned**: Inheritance support, config-class route detection, cross-session cache persistence

---

- **计划**: Micronaut / Quarkus 支持、Spring Boot Actuator 集成
- **计划**: HTTP 请求测试、Services 树视图
- **计划**: 继承关系支持、配置类路由检测、跨会话缓存
