# RestfulToolkit

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.5-green.svg)](https://github.com/tedburner/RestfulToolkit)
[![Downloads](https://img.shields.io/badge/downloads-111-blue.svg)](https://marketplace.visualstudio.com/items?itemName=kiturone.restful-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[English Documentation](README.md)** | **中文文档**

一个用于搜索和导航 Java/Kotlin Spring 和 JAX-RS 项目中 RESTful API 端点的 VS Code 扩展。

## 为什么需要 RestfulToolkit？

在中大型 Spring Boot 或 JAX-RS 项目中，查找 API 端点是一个日常痛点：

- **没有统一入口**：路由分散在数十个 `@RestController` 类和方法中——你只能手动搜索文件或 grep 注解。
- **缺少全局概览**：没有内置方式能快速查看"这个项目暴露了哪些端点"。
- **API 测试准备繁琐**：从 Controller 注解手动拼写请求体、表单数据或 cURL 命令浪费时间。

RestfulToolkit 通过扫描项目中所有 `@RequestMapping` / `@Path` 注解，将它们索引为可搜索数据库，让你在一个快速选择面板中完成搜索、跳转、复制和测试——**零配置即可使用**。

## 目标用户

- **Java / Kotlin 后端开发者**：使用 Spring MVC、Spring Boot 或 JAX-RS 框架开发
- **QA / API 测试人员**：需要快速查找端点并生成 cURL / JSON 请求体用于测试
- **代码审查者**：想快速审计所有暴露的 API 路由，而不必逐个打开 Controller 文件

## 核心功能亮点

### 🔍 一个面板搜索所有端点

按 URL 路径、类名、方法名或 HTTP 方法模糊搜索。点击即跳转到 Controller 方法——再也不用 Ctrl+Shift+F 逐个 grep。

### 📋 智能参数复制

右键任意端点 → 以 **URL Params**、**JSON Body**、**Form Data** 或 **x-www-form-urlencoded** 格式复制参数。嵌套 DTO 字段自动展开至 3 层，驼峰/蛇形命名自动检测。

### 📡 一键生成 cURL

生成开箱即用的 cURL 命令（HTTP 方法 + URL + 请求头 + 请求体含 DTO 展开），可直接导入 Postman、Bruno 或 Insomnia。

### ⚡ 零配置，实时同步

自动从 `application.yml` / `application.properties` 检测 Base URL。监听文件变更实时更新端点缓存——装好就能用。

### 完整功能列表

| 功能 | 说明 |
|------|------|
| 快速搜索 | 按路径、类、方法、HTTP 方法模糊搜索 |
| 即时导航 | 一键跳转到 Controller 定义 |
| 实时更新 | 文件变更时自动扫描并更新缓存 |
| 可视化标识 | 颜色编码的 HTTP 方法图标 |
| 复制参数 | URL Params / JSON Body / Form Data / x-www-form-urlencoded |
| 复制完整 URL | Base URL + 路径 + 查询参数 |
| 复制为 cURL | 方法 + URL + 请求头 + 请求体，可直接导入 Postman |
| Base URL 自动检测 | 从 application.yml / properties 读取端口和 context-path |
| 命名转换 | 驼峰 / 蛇形命名自动检测 |
| DTO 展开 | 嵌套 DTO 字段自动解析至 3 层 |
| 可配置 | 自定义扫描路径和排除模式 |

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
