# Changelog

All notable changes to RestfulToolkit will be documented in this file.
本文档记录 RestfulToolkit 的所有重要变更。

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.4] - 2026-04-29

### Added / 新增

- **Copy Full URL / 复制完整 URL**: Right-click command to copy the complete endpoint URL (base URL + full path with class-level path + path parameter placeholders + query params). 右键菜单新增命令，复制完整端点 URL（含 Base URL、类级路径、路径参数占位符、查询参数）。
- **Copy as cURL / 复制为 cURL 命令**: Right-click command to generate a cURL command with HTTP method, URL, headers, and request body. Output is directly importable into Postman, Bruno, and Insomnia. 右键菜单新增命令，生成包含 HTTP 方法、URL、请求头、请求体的 cURL 命令，可直接导入 Postman/Bruno/Insomnia。
- **Base URL Configuration / Base URL 配置**: New `restfulToolkit.baseUrl` setting with fallback chain: user config → auto-detect from `application.yml`/`application.properties` → default `http://localhost:8080`. 新增 `restfulToolkit.baseUrl` 配置项，支持三级回退：用户配置 → 自动检测 application.yml/properties → 默认值。
- **Header Parameter Parsing / 请求头参数解析**: Support for `@RequestHeader` (Spring) and `@HeaderParam` (JAX-RS) annotations. Headers are included in cURL output. 支持 `@RequestHeader`（Spring）和 `@HeaderParam`（JAX-RS）注解，请求头自动包含在 cURL 输出中。
- **Class-level Path Concatenation / 类级路径拼接**: Copy commands now correctly concatenate class-level `@RequestMapping`/`@Path` with method-level paths. 复制命令现在正确拼接类级 `@RequestMapping`/`@Path` 与方法级路径。
- **New test cases / 新增测试**: UrlGenerator tests (5 cases), CurlConverter tests (5 cases), BaseUrlResolver tests (5 cases), Spring `@RequestHeader` tests (2 cases), JAX-RS `@HeaderParam` tests (1 case).

## [0.0.3] - 2026-04-27

### Fixed / 修复

- **Generic Type DTO Resolution / 泛型类型 DTO 解析**: Fixed `List<UserDto>` and other generic collection types failing to resolve nested DTO fields. Added `extractGenericTypes` to extract inner type parameters and `resolveNestedDtoFields` for generic container DTO. 修复 `List<UserDto>` 等泛型集合类型无法展开嵌套 DTO 的问题。
- **Debounced Scan Error Handling / 防抖扫描异常处理**: Fixed unhandled promise rejection in `scanFileDebounced` setTimeout callback. 修复防抖扫描中 setTimeout 回调缺少 catch 的问题。

### Added / 新增

- **Copy Endpoint Parameters / 复制接口参数**: Right-click context menu to copy endpoint parameters in multiple formats. 右键菜单支持多种格式复制接口参数：
  - URL Params: `?key1=&key2=` (GET/DELETE requests)
  - JSON Body: `{"key": ""}` with DTO field expansion (POST/PUT/PATCH with `@RequestBody`)
  - Form Data: `key: ` line-by-line format (`@ModelAttribute` with DTO expansion)
  - x-www-form-urlencoded: `key1=&key2=` format
  - 支持 URL 参数、JSON Body（含 DTO 字段展开）、Form Data（含 `@ModelAttribute` 展开）、x-www-form-urlencoded 格式

- **Nested DTO Expansion / 嵌套 DTO 展开**: Recursive DTO field resolution up to 3 levels deep with circular reference protection. Supports `@JsonProperty`, `@JsonAlias`, `@JSONField`, and `@JsonNaming` (SnakeCaseStrategy, KebabCaseStrategy) annotations. 递归解析嵌套 DTO 字段（最多 3 层），循环引用保护，支持 Jackson/Fastjson 注解。

- **Auto Format Detection / 自动格式检测**: Automatically detects output format based on HTTP method and parameter type (url-params for GET/DELETE, json for @RequestBody, form-data for @ModelAttribute). 根据 HTTP 方法和参数类型自动检测输出格式。

- **Naming Convention Transform / 命名风格转换**: Auto-detects naming convention (snake_case if >50% of names contain underscores) with camelCase/snake_case toggle. 自动检测命名风格（超 50% 含下划线则为蛇形），支持驼峰/蛇形切换。

- **i18n Support / 国际化支持**: Command titles now support Chinese and English via `package.nls.json` and `package.nls.zh-cn.json`. 命令标题支持中英文切换。

- **Batch Test Script / 批量测试脚本**: `test-parameter-copy.js` with 75 tests covering Spring/JAX-RS parsing, DTO extraction, format conversion, and file integrity checks. 75 个测试用例覆盖解析、提取、格式转换和文件完整性。

### Changed / 变更

- **SpringParameterParser**: Fixed `splitParameters` to track parentheses depth, correctly parsing annotations with `defaultValue`. 修复参数拆分逻辑，正确解析含 `defaultValue` 的注解。
- **ParameterExtractor**: Improved `findMethodAtPosition` to handle multi-line method signatures with annotations on separate lines. 改进多行方法签名查找逻辑。
- **Test Project**: Consolidated test files to manageable set (TestController, TestResource, FormController + DTOs). 整合测试项目文件。

## [0.0.2] - 2026-04-20

### Fixed / 修复

- **Line Number Accuracy / 行号定位准确性**: Fixed annotation line positioning - endpoints now correctly navigate to the annotation line (e.g., `@GetMapping`) instead of the method definition line. 修复注解行定位问题 - 端点现在正确跳转到注解行（如 `@GetMapping`）而不是方法定义行。
  
- **Multi-path Annotation Splitting / 多路径注解拆分**: Fixed regex pattern to correctly split multi-path annotations like `@GetMapping({"/users", "/list"})` into separate endpoints. 修复正则表达式，正确拆分多路径注解（如 `@GetMapping({"/users", "/list"}`）为独立端点。

- **Path Concatenation / 路径拼接**: Fixed duplicate slash issue in path joining - class and method paths now merge correctly without redundant slashes. 修复路径拼接中的重复斜杠问题 - 类级别和方法级别路径现在正确合并，无冗余斜杠。

- **JAX-RS Line Positioning / JAX-RS 行号定位**: JAX-RS endpoints now navigate to HTTP method annotation lines (`@GET`, `@POST`) instead of `@Path` annotation lines. JAX-RS 端点现在跳转到 HTTP 方法注解行（`@GET`, `@POST`）而不是 `@Path` 注解行。

- **Annotation Array Parsing / 注解数组解析**: Fixed regex to avoid misidentifying non-path arrays (like `produces`, `consumes`) as multi-path annotations. 修复正则表达式，避免误将非路径数组（如 `produces`, `consumes`）识别为多路径注解。

- **ESLint Code Quality / ESLint 代码质量**: Fixed 3 ESLint errors (prefer-const violations) in JaxRsParser and SpringMvcParser. 修复 JaxRsParser 和 SpringMvcParser 中的 3 个 ESLint 错误（prefer-const 规则）。

### Added / 新增

- **Multi-annotation Support / 多注解支持**: Enhanced parser to correctly identify REST endpoints when methods have multiple non-REST annotations (e.g., `@Async`, `@Transactional` before `@GetMapping`). 增强解析器，当方法有多个非 REST 注解时（如 `@GetMapping` 前的 `@Async`, `@Transactional`）也能正确识别 REST 端点。

- **Automated Test Suite / 自动化测试套件**: Added comprehensive validation script with 49 endpoints testing. 新增包含 49 个端点的综合验证脚本：
  - Line number accuracy (100%) / 行号准确性（100%）
  - Multi-path splitting correctness / 多路径拆分正确性
  - Kotlin file support / Kotlin 文件支持
  - Spring vs JAX-RS framework detection / Spring 与 JAX-RS 框架识别
  - Path concatenation validation / 路径拼接验证

- **Test Coverage Documentation / 测试覆盖文档**: Added detailed test coverage checklist with 95% coverage rating. 新增详细的测试覆盖清单，覆盖率 95%。

### Changed / 变更

- **Documentation Structure / 文档结构**: Reorganized and consolidated documentation. 重新整理和合并文档：
  - Removed 8 redundant/outdated documents / 删除 8 个冗余/过时文档
  - Merged 3 duplicate test guides into unified TESTING_GUIDE.md / 合并 3 个重复测试指南为统一的 TESTING_GUIDE.md
  - Consolidated acceptance test README into test-project README / 合并验收测试 README 到 test-project README

- **Test Script Organization / 测试脚本组织**: Cleaned up test scripts. 清理测试脚本：
  - Removed 3 temporary test scripts from root directory / 从根目录删除 3 个临时测试脚本
  - Standardized test structure: Mocha unit tests + automated validation / 标准化测试结构：Mocha 单元测试 + 自动化验证

- **Directory Structure / 目录结构**: Optimized project structure. 优化项目结构：
  - Removed empty directories and duplicate demo files / 删除空目录和重复示例文件
  - Cleaned up build artifacts and temporary files / 清理构建产物和临时文件
  - Achieved optimal structure with clear separation of concerns / 达到最优结构，职责清晰分离

### Improved / 改进

- **Testing Infrastructure / 测试基础设施**: Enhanced test coverage to 95% with automated validation. 通过自动化验证增强测试覆盖率至 95%。

- **Code Quality / 代码质量**: All TypeScript code now passes ESLint validation. 所有 TypeScript 代码现在通过 ESLint 验证。

- **Documentation / 文档**: Clear, concise documentation with no redundancy. 清晰简洁的文档，无冗余内容。

## [0.0.1] - 2026-04-19

### Added
- Initial release of RestfulToolkit VS Code extension
- Fast fuzzy search for REST endpoints by path, class name, method name, or HTTP method
- Instant navigation to controller method definitions
- Real-time endpoint cache updates on file changes
- Color-coded HTTP method icons (GET=green, POST=blue, PUT=yellow, DELETE=red, PATCH=purple)
- Support for Spring MVC/Spring Boot annotations:
  - `@RequestMapping` (class and method level)
  - `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
  - Multi-path annotations
- Support for JAX-RS annotations:
  - `@Path` (class and method level)
  - `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`
- Support for Java and Kotlin files
- Configurable scan paths and exclusion patterns
- Manual refresh command to force re-scan
- Progress indicator during scanning
- Status bar notifications
- Logging output channel for troubleshooting

### Features
- Keyboard shortcuts:
  - Windows/Linux: `Ctrl+Alt+N` or `Ctrl+\`
  - Mac: `Cmd+Alt+N` or `Cmd+\`
- Command palette integration:
  - "RestfulToolkit: Search REST Endpoints"
  - "RestfulToolkit: Refresh Endpoints"
- VS Code settings:
  - `restfulToolkit.scanPaths`: Configure scan paths
  - `restfulToolkit.excludePaths`: Configure exclusion patterns
  - `restfulToolkit.maxResults`: Limit search results

### Known Limitations
- Cannot detect inherited annotations from parent classes
- Cannot resolve property placeholders (`${api.path}`)
- Limited support for Kotlin string templates
- Cannot detect configuration-class routes
- ~80-85% endpoint detection accuracy

### Technical Details
- Built with TypeScript and VS Code Extension API
- Uses regex-based annotation parsing
- Implements weighted fuzzy search algorithm
- Debounced file change handling
- Map-based endpoint cache with path and file indexes

## [Unreleased]

### Planned Features
- Support for Micronaut framework
- Support for Quarkus framework
- Integration with Spring Boot Actuator runtime data
- HTTP request testing capabilities
- Services tree view panel
- Enhanced inheritance support
- Configuration class route detection
- Cache persistence across sessions