# Changelog

All notable changes to RestfulToolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
