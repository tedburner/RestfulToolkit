# RestfulToolkit

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.3-green.svg)](https://github.com/tedburner/RestfulToolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[English Documentation](README.md)** | **中文文档**

一个用于搜索和导航 Java/Kotlin Spring 和 JAX-RS 项目中 RESTful API 端点的 VS Code 扩展。

## 功能特性

- 🔍 **快速搜索**：通过路径、类名、方法名或 HTTP 方法快速模糊搜索 REST 端点
- 🎯 **即时导航**：一键跳转到 Controller 方法定义
- 🚀 **实时更新**：文件变更时自动扫描并更新端点缓存
- 🎨 **可视化标识**：颜色编码的 HTTP 方法图标（GET、POST、PUT、DELETE、PATCH）
- ⚙️ **可配置**：自定义扫描路径和排除模式
- 🔄 **手动刷新**：按需强制重新扫描
- 📋 **复制参数**：右键菜单支持 URL Params、JSON Body、Form Data、x-www-form-urlencoded 格式复制接口参数
- 🔀 **命名转换**：自动检测或切换驼峰/蛇形命名风格
- 📦 **DTO 展开**：嵌套 DTO 字段自动展开（最多 3 层）

## 支持的框架

### Spring MVC / Spring Boot
- `@RequestMapping`（类和方法级别）
- `@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping`、`@PatchMapping`
- 带有 `method` 参数的 `@RequestMapping`
- 多路径注解：`@GetMapping({"/users", "/list"})`

### JAX-RS
- `@Path`（类和方法级别）
- `@GET`、`@POST`、`@PUT`、`@DELETE`、`@PATCH`

### 支持的文件类型
- Java（`*.java`）
- Kotlin（`*.kt`）

## 安装

### 从 VS Code 市场安装
1. 打开 VS Code
2. 进入扩展视图（Ctrl+Shift+X）
3. 搜索 "RestfulToolkit"
4. 点击安装

### 从源码安装
1. 克隆仓库
2. 运行 `npm install`
3. 运行 `npm run compile`
4. 在 VS Code 中按 F5 启动扩展开发宿主

## 使用方法

### 搜索端点

使用键盘快捷键：
- **Windows/Linux**：`Ctrl+Alt+N` 或 `Ctrl+\`
- **Mac**：`Cmd+Alt+N` 或 `Cmd+\`

或通过命令面板：
1. 按 `Ctrl+Shift+P`（Windows/Linux）或 `Cmd+Shift+P`（Mac）
2. 输入 "RestfulToolkit: Search REST Endpoints"
3. 从搜索结果中选择端点
4. 文件打开并跳转到方法定义

### 刷新端点

手动刷新端点缓存：
1. 按 `Ctrl+Shift+P`（Windows/Linux）或 `Cmd+Shift+P`（Mac）
2. 输入 "RestfulToolkit: Refresh Endpoints"
3. 等待扫描完成

## 配置

RestfulToolkit 支持两个级别的配置：

### 🌐 全局/工作区设置（VS Code 设置）

在 VS Code 设置中配置（`Ctrl+,` / `Cmd+,`）：

```json
{
  "restfulToolkit.scanPaths": [
    "**/src/main/java/**/*.java",
    "**/src/main/kotlin/**/*.kt"
  ],
  "restfulToolkit.excludePaths": [
    "**/src/test/**",
    "**/target/**",
    "**/build/**",
    "**/.gradle/**",
    "**/node_modules/**"
  ],
  "restfulToolkit.maxResults": 100
}
```

### 📁 项目级配置（推荐）

在项目根目录创建 `.restful-toolkit.json` 进行项目级自定义：

```json
{
  "scanPaths": [
    "**/src/main/java/**/*.java"
  ],
  "excludePaths": [
    "**/src/test/**",
    "**/target/**"
  ],
  "maxResults": 200
}
```

**优先级顺序**：项目 `.restful-toolkit.json` > VS Code 设置 > 默认配置

> 💡 **提示**：项目级配置适合团队共享和多模块项目。可以将该文件提交到 Git，确保团队成员配置一致。

### 设置说明

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `scanPaths` | `array` | `["**/src/main/java/**/*.java", "**/src/main/kotlin/**/*.kt"]` | 扫描文件的 glob 模式 |
| `excludePaths` | `array` | `["**/src/test/**", "**/target/**", ...]` | 排除扫描的 glob 模式 |
| `maxResults` | `number` | `100` | 显示的最大搜索结果数 |
| `copyNameFormat` | `string` | `"camelCase"` | 复制参数的默认命名格式（`"camelCase"` 或 `"snake_case"`） |

### 复制参数

在 Controller 方法中右键复制接口参数：

1. 将光标放在 REST 端点方法上
2. 右键选择「复制接口参数」
3. 选择输出格式：
   - **URL Params**：`?param1=&param2=` — 适用于 GET/DELETE 请求
   - **JSON Body**：`{"field": ""}` — 适用于 POST/PUT/PATCH（`@RequestBody`）
   - **Form Data**：`field: ` 逐行格式 — 适用于 `@ModelAttribute`
   - **x-www-form-urlencoded**：`field1=&field2=` — URL 编码表单
4. 选择命名风格（自动检测，可切换驼峰/蛇形）

**支持的注解**：
- **Spring**：`@RequestParam`, `@PathVariable`, `@RequestBody`, `@RequestPart`, `@ModelAttribute`
- **JAX-RS**：`@PathParam`, `@QueryParam`, `@FormParam`
- **JSON**：`@JsonProperty`, `@JsonAlias`, `@JSONField`, `@JsonNaming`

**DTO 展开**：`@RequestBody` 和 `@ModelAttribute` 参数自动展开嵌套 DTO 字段（最多 3 层）。

## 已知限制

第一版有以下限制：

### 1. 继承关系
无法检测从父类继承的端点。如果 Controller 继承了带有 `@RequestMapping` 的基类，只能检测到子类的直接注解。

### 2. 属性文件动态路径
无法解析注解中的属性占位符，如 `${api.path}`。

### 3. 配置类路由
无法检测通过 `@Configuration` 类配置的路由（非注解路由）。

### 4. Kotlin 字符串模板
对 Kotlin 字符串模板（如注解路径中的 `"${basePath}/users"`）支持有限。

### 5. 复杂条件注解
无法评估影响端点可用性的条件注解，如 `@ConditionalOnProperty`。

**预期准确度**：对于典型 Spring Boot 项目约 80-85% 的端点检测率。

## 故障排除

### 未找到端点
- 检查项目是否包含带有 Spring MVC 或 JAX-RS 注解的 Java 或 Kotlin 文件
- 验证设置中的扫描路径是否与项目结构匹配
- 尝试手动刷新："RestfulToolkit: Refresh Endpoints"

### 查看日志
- 打开命令面板
- 输入 "RestfulToolkit: Show Logs"
- 查看输出通道中的扫描详情和错误信息

## 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情见 [LICENSE](LICENSE) 文件。

## 致谢

- 灵感来自 IntelliJ IDEA 的 REST 端点搜索功能
- 使用 VS Code 扩展 API 构建
- 特别感谢 Spring 和 JAX-RS 社区

## 发展路线

未来增强：
- [ ] 支持 Micronaut 和 Quarkus 框架
- [ ] 集成 Spring Boot Actuator 运行时数据
- [ ] HTTP 请求测试（类似 Postman 的功能）
- [ ] 服务树视图
- [ ] 更好的继承和配置类支持

### v0.0.3 已完成
- [x] 复制接口参数（JSON Body、URL Params、Form Data、x-www-form-urlencoded）
- [x] 嵌套 DTO 字段展开（最多 3 层）
- [x] 命名风格转换（驼峰 / 蛇形）
- [x] 国际化支持（英文 / 中文）

---

**享受更快的 REST 端点导航！** 🚀