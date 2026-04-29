# RestfulToolkit

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.4-green.svg)](https://github.com/tedburner/RestfulToolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[English Documentation](README.md)** | **中文文档**

一个用于搜索和导航 Java/Kotlin Spring 和 JAX-RS 项目中 RESTful API 端点的 VS Code 扩展。

## 功能特性

- 🔍 **快速搜索**：通过路径、类名、方法名或 HTTP 方法快速模糊搜索 REST 端点
- 🎯 **即时导航**：一键跳转到 Controller 方法定义
- 🚀 **实时更新**：文件变更时自动扫描并更新端点缓存
- 🎨 **可视化标识**：颜色编码的 HTTP 方法图标（GET=绿, POST=蓝, PUT=黄, DELETE=红, PATCH=紫）
- 📋 **复制参数**：右键支持 URL Params、JSON Body、Form Data、x-www-form-urlencoded 格式复制接口参数
- 🔗 **复制完整 URL**：一键复制完整端点 URL（含 Base URL + 完整路径 + 查询参数）
- 📡 **复制为 cURL**：一键复制 cURL 命令（含方法、URL、请求头、请求体），可直接导入 Postman/Bruno/Insomnia
- ⚙️ **Base URL 自动检测**：自动从 `application.yml` / `application.properties` 读取端口和 context-path
- 🔀 **命名转换**：自动检测或切换驼峰/蛇形命名风格
- 📦 **DTO 展开**：嵌套 DTO 字段自动展开（最多 3 层）
- ⚙️ **可配置**：自定义扫描路径和排除模式

## 支持的框架

### Spring MVC / Spring Boot
- `@RequestMapping`（类和方法级别）
- `@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping`、`@PatchMapping`
- 多路径注解：`@GetMapping({"/users", "/list"})`

### JAX-RS
- `@Path`（类和方法级别）
- `@GET`、`@POST`、`@PUT`、`@DELETE`、`@PATCH`

### 支持的文件类型
- Java（`*.java`）、Kotlin（`*.kt`）

## 安装

在 VS Code 扩展视图（Ctrl+Shift+X）中搜索 "RestfulToolkit" 并点击安装。

**从源码安装**：`git clone` → `npm install` → `npm run compile` → 在 VS Code 中按 F5。

## 使用方法

### 搜索端点

快捷键：
- **Windows/Linux**：`Ctrl+Alt+N` 或 `Ctrl+\`
- **Mac**：`Cmd+Alt+N` 或 `Cmd+\`

或命令面板："RestfulToolkit: Search REST Endpoints"

### 刷新端点

命令面板："RestfulToolkit: Refresh Endpoints"

## 配置

RestfulToolkit 支持三级配置：

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `scanPaths` | `array` | `["**/src/main/java/**/*.java", "**/src/main/kotlin/**/*.kt"]` | 扫描文件的 glob 模式 |
| `excludePaths` | `array` | `["**/src/test/**", "**/target/**", ...]` | 排除扫描的 glob 模式 |
| `maxResults` | `number` | `100` | 显示的最大搜索结果数 |
| `copyNameFormat` | `string` | `"camelCase"` | 复制参数的默认命名格式 |
| `baseUrl` | `string` | `""` | 生成 URL 和 cURL 命令的 Base URL，留空时自动检测 |

**优先级**：VS Code 设置 > 项目根目录 `.restful-toolkit.json` > 默认配置

## 复制命令

### 复制参数

在 Controller 方法上右键 → "复制接口参数"：
1. 选择格式：URL Params / JSON Body / Form Data / x-www-form-urlencoded
2. 选择命名风格：camelCase / snake_case（自动检测）

**支持的注解**：
- **Spring**：`@RequestParam`, `@PathVariable`, `@RequestBody`, `@RequestPart`, `@ModelAttribute`, `@RequestHeader`
- **JAX-RS**：`@PathParam`, `@QueryParam`, `@FormParam`, `@HeaderParam`
- `@RequestBody` 和 `@ModelAttribute` 参数自动展开嵌套 DTO 字段（最多 3 层）

### 复制完整 URL

输出：`http://localhost:8080/api/users/{id}?keyword=`
- Base URL 解析顺序：VS Code 设置 → `application.yml`/`application.properties` → 默认 `http://localhost:8080`
- 路径参数保留 `{占位符}` 形式

### 复制为 cURL

包含：HTTP 方法、完整 URL、请求头（`@RequestHeader`/`@HeaderParam`）、请求体（含 DTO 展开）。
可直接导入 Postman、Bruno、Insomnia。

示例：`curl -X POST 'http://localhost:8080/api/users' -H 'Content-Type: application/json' -d '{"name": "", "email": ""}'`

## 已知限制

- 无法检测从父类继承的端点
- 无法解析属性占位符（`${api.path}`）
- 无法检测 `@Configuration` 类配置的路由
- Kotlin 字符串模板支持有限
- 无法评估条件注解（`@ConditionalOnProperty`）

**预期准确度**：对于典型 Spring Boot 项目约 80-85% 的端点检测率。

## 故障排除

- **未找到端点**：确认扫描路径与项目结构匹配，然后运行 "RestfulToolkit: Refresh Endpoints"
- **查看日志**：命令面板 → "RestfulToolkit: Show Logs" → 查看输出通道

## 发展路线

- 支持 Micronaut 和 Quarkus 框架
- 集成 Spring Boot Actuator 运行时数据
- HTTP 请求测试（类似 Postman 的功能）
- 服务树视图面板
- 更好的继承和配置类支持

## 许可证

MIT — 见 [LICENSE](LICENSE) 文件。

**享受更快的 REST 端点导航！**
