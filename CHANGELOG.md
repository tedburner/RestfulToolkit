# Changelog

All notable changes to RestfulToolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.8] - 2026-08-12

- **Fixed**: Spring and JAX-RS class paths are now scoped to type declarations; nested controllers retain endpoint ownership and absolute navigation lines, and long method declarations no longer depend on fixed character windows
- **Fixed**: Workspace and watcher scans now share post-scan `mtime + size` state recording, while file deletion removes both endpoint and scan records
- **Fixed**: File scans now validate `mtime + size` before and after parsing and atomically commit cache/state only when metadata remains stable, preventing stale endpoints from being marked current
- **Changed**: Base URL discovery now uses only the asynchronous VS Code filesystem path, and its configuration watcher is limited to application/bootstrap files under `main/resources`
- **Fixed**: Watched files now replace their complete endpoint set, so removing the last endpoint no longer leaves stale search results
- **Fixed**: Queued refreshes survive scan failures, shutdown drains configuration reloads and any active scan, scan status timers cannot cross runs, and asynchronous Base URL invalidation cannot restore stale state
- **Changed**: Extension commands register before background indexing; search remains available during indexing with bounded QuickPick results
- **Fixed**: An open search QuickPick now refreshes its current query when background indexing completes and shows the empty-index warning when no endpoints are found
- **Changed**: Workspace scanning now combines include discovery, skips files without supported REST annotations, honors watcher exclusions, and emits aggregate logs
- **Changed**: Endpoint top-K search now uses a stable bounded heap, and Base URL discovery uses event-invalidated process-local caching
- **Changed**: Endpoint search now streams multi-token score aggregation and canonicalizes repeated text tokens without changing matching, ranking, or result limits
- **Changed**: Internal scan cleanup, Base URL config merging, and extension reload orchestration were consolidated without changing observable behavior
- **Added**: Regression coverage for activation ordering, empty endpoint replacement, scan prefiltering/exclusions, heap scaling, QuickPick limits, and workspace-scoped Base URL invalidation
- **Fixed**: JAX-RS methods with identical annotation blocks retain their own source lines, and watcher exclusions support workspace-relative patterns such as `module/build/**`
- **Fixed**: Copy Full URL and Copy as cURL now use the first source-declared path for Spring mappings with multiple paths instead of falling back to the class path
- **Fixed**: Marketplace stats updater now reports the README badge before/after value and fails when the installs badge is missing instead of silently succeeding
- **Changed**: Marketplace stats workflow now uses Node.js 24-compatible GitHub Actions
- **Changed**: VSIX prepublish now runs the production Webpack build and packages only the runtime bundle instead of TypeScript compiler output and test artifacts
- **Added**: Local regression test for README Marketplace installs badge updates

---

- **修复**: Spring 与 JAX-RS 类级路径限定在类型声明前；嵌套 Controller 保持正确端点归属和绝对跳转行号，长方法声明不再依赖固定字符窗口
- **修复**: 工作区扫描与 watcher 扫描统一在成功后记录 `mtime + size`，删除文件时同步移除端点与扫描状态
- **修复**: 文件解析前后校验 `mtime + size`，仅在元数据稳定时原子提交缓存与扫描状态，避免旧端点被标记为最新
- **优化**: Base URL 配置发现只使用 VS Code 异步文件系统，并将配置 watcher 收窄到 `main/resources` 下的 application/bootstrap 文件
- **修复**: 受监听文件改为整体替换端点集合，删除最后一个端点后不再残留陈旧搜索结果
- **修复**: 扫描失败不再丢失排队刷新；扩展停用会等待配置重载与任意当前扫描；状态栏定时器不再跨轮生效；异步 Base URL 失效不会恢复陈旧状态
- **优化**: 扩展先注册命令再后台索引；索引期间仍可搜索当前结果，QuickPick 条目数量受配置限制
- **修复**: 已打开的搜索 QuickPick 会在后台索引完成后刷新当前查询，未发现端点时显示空索引提示
- **优化**: 工作区扫描合并 include 查询、跳过无 REST 注解文件、应用 watcher 排除规则并汇总日志
- **优化**: 端点 top-K 搜索改用稳定有界堆，Base URL 配置发现改用事件失效的进程内缓存
- **优化**: 端点搜索改为流式聚合多词评分并规范化重复文本 token，匹配、排序和结果上限保持不变
- **优化**: 合并扫描清理、Base URL 配置合并与扩展重载编排的重复内部流程，外部行为保持不变
- **新增**: 激活顺序、空端点替换、扫描预筛选/排除、堆伸缩性、QuickPick 上限和工作区级 Base URL 失效回归测试
- **修复**: 相同 JAX-RS 注解块保留各自源码行号；watcher 排除规则支持 `module/build/**` 等工作区相对模式
- **修复**: Spring mapping 声明多个路径时，复制完整 URL/cURL 会使用源码中第一个声明路径，不再错误退回类级路径
- **修复**: Marketplace 统计更新脚本现在会输出 README 徽章更新前后值，并在安装量徽章缺失时失败，避免静默成功
- **优化**: Marketplace 统计工作流改用兼容 Node.js 24 的 GitHub Actions
- **优化**: VSIX 预发布改为执行 Webpack 生产构建，并只打包运行时 bundle，不再包含 TypeScript 编译产物和测试文件
- **新增**: README Marketplace 安装量徽章更新的本地回归测试

## [0.0.7] - 2026-06-15

- **Fixed**: Endpoint search acronym ranking now uses original camelCase text, and `npm test` runs reliably with the VS Code API mock
- **Fixed**: Endpoint cache results are isolated from caller mutation, and Base URL cache invalidation now handles same-size config rewrites with unchanged mtimes
- **Changed**: Optimized workspace scanning, Spring MVC parsing, endpoint search, DTO field extraction, and Base URL detection with bounded work and process-local caches
- **Changed**: Cleaned up config creation, Search QuickPick icons, text sanitization, parser internals, and JSON-to-DTO logging implementation details
- **Added**: Regression coverage for scan deduplication/concurrency, Spring mapping source-order parsing, repeated DTO extraction, Base URL cache invalidation, and endpoint search precomputation; completed the optimization task backlog

---

- **修复**: 端点搜索首字母缩写排序使用原始 camelCase 文本，`npm test` 可通过 VS Code API mock 稳定运行
- **修复**: 端点缓存返回值与调用方修改隔离，并增强 Base URL 缓存失效以覆盖同大小配置重写且 mtime 未变的情况
- **优化**: 工作区扫描、Spring MVC 解析、端点搜索、DTO 字段提取与 Base URL 检测性能优化，包含扫描限流、注解源码顺序解析、进程内缓存
- **优化**: 清理配置创建、搜索图标、文本净化、解析器内部逻辑和 JSON 转 DTO 日志等实现细节
- **新增**: 扫描去重/并发、Spring mapping 源码顺序解析、重复 DTO 提取、Base URL 缓存失效与端点搜索预计算回归测试，并完成优化任务清单

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
