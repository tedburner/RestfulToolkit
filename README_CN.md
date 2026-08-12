# RestfulToolkit

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.8-green.svg)](https://github.com/tedburner/RestfulToolkit)
[![Installs](https://img.shields.io/badge/installs-295-blue.svg)](https://marketplace.visualstudio.com/items?itemName=kiturone.restful-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md) | **中文**

RestfulToolkit 是一个 VS Code 扩展，用于在 Java/Kotlin 的 Spring MVC、Spring Boot 和 JAX-RS 项目中查找、跳转和复制 RESTful API 端点。

它会扫描 Controller 注解，构建可搜索的端点索引，让你可以在 VS Code 内完成源码跳转、参数复制、完整 URL/cURL 生成，以及从 JSON 生成 DTO 类。

## 功能亮点

| 能力 | 说明 |
|------|------|
| 端点搜索 | 按 URL 路径、类名、方法名、HTTP 方法、camelCase 缩写或多关键词搜索；后台索引期间仍可使用 |
| 源码跳转 | 从 QuickPick 结果跳转到准确的 Controller 注解行 |
| 参数复制 | 将端点参数复制为 URL Params、JSON Body、Form Data 或 x-www-form-urlencoded |
| DTO 展开 | 自动展开最多 3 层嵌套请求 DTO 字段，并支持常见 JSON 命名注解 |
| URL 和 cURL 复制 | 生成包含请求头、查询参数和请求体的完整 URL/cURL |
| Base URL 检测 | 通过工作区级、事件失效的内存缓存异步读取 Spring 配置 |
| JSON 转 DTO | 从选中文本或剪贴板 JSON 生成 Java/Kotlin DTO 类 |
| 实时更新 | 监听 Java/Kotlin 文件变更、遵守工作区相对排除规则，并只在扫描元数据稳定后原子替换端点 |

## 支持的项目

### 框架

- Spring MVC / Spring Boot
- 使用 `javax.ws.rs` 或 `jakarta.ws.rs` 的 JAX-RS

### 文件类型

- Java: `*.java`
- Kotlin: `*.kt`

### 端点注解

| 框架 | 支持的注解 |
|------|------------|
| Spring | `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping` |
| JAX-RS | `@Path`, `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH` |

多路径注解会拆分为多个端点，例如 `@GetMapping({"/users", "/list"})`。

## 安装

在 VS Code 扩展视图中安装：

1. 使用 `Ctrl+Shift+X` 打开扩展视图。
2. 搜索 `RestfulToolkit`。
3. 点击 Install。

从源码运行：

```bash
git clone https://github.com/tedburner/RestfulToolkit.git
cd RestfulToolkit
npm install
npm run compile
```

然后在 VS Code 中按 `F5` 启动扩展开发宿主。

## 使用方式

### 搜索端点

打开命令：

- 命令面板：`RestfulToolkit: Search REST Endpoints`
- Windows/Linux: `Ctrl+Alt+N` 或 `Ctrl+\`
- macOS: `Cmd+Alt+N` 或 `Cmd+\`

搜索支持：

- 路径片段：`users`
- HTTP 方法：`post`
- 多关键词：`post create`
- camelCase 缩写：`dtc` 匹配 `DataTransferController`

命令会在首次扫描完成前注册。后台索引期间打开搜索时，QuickPick 会显示当前已发现的端点和索引提示；索引完成后会按当前查询刷新结果，若仍未发现端点则关闭并显示常规空索引提示。初始结果与过滤结果均遵守 `restfulToolkit.maxResults`。

搜索保持既有的匹配与排序行为，同时在内存中只处理一次重复的文本关键词。

### 复制端点参数

在 Controller 方法上右键，选择 `RestfulToolkit: Copy Endpoint Parameters`。

支持的参数来源：

| 框架 | 支持的参数注解 |
|------|----------------|
| Spring | `@RequestParam`, `@PathVariable`, `@RequestBody`, `@RequestPart`, `@ModelAttribute`, `@RequestHeader` |
| JAX-RS | `@PathParam`, `@QueryParam`, `@FormParam`, `@HeaderParam` |

输出格式：

- URL Params
- JSON Body
- Form Data
- x-www-form-urlencoded

当工作区中能解析到 DTO 类时，`@RequestBody` 和 `@ModelAttribute` 参数会自动展开字段。

### 复制完整 URL

在端点上右键，选择 `RestfulToolkit: Copy Full URL`。

如果 Spring mapping 同时声明多个路径，复制命令会稳定使用源码中第一个声明路径；端点搜索仍会分别索引每一个声明路径。

输出示例：

```text
http://localhost:8080/api/users/{id}?keyword=
```

Base URL 解析顺序：

1. `restfulToolkit.baseUrl` VS Code 设置
2. 工作区根目录下的 `.restful-toolkit.json`
3. Spring 配置文件，例如 `application.yml`、`application.properties`、`bootstrap.yml` 和 profile 文件
4. 默认值 `http://localhost:8080`

自动检测结果只保存在 Extension Host 内存中。创建、修改或删除受支持的 Spring 配置文件时，会主动使所属工作区缓存失效。

### 复制为 cURL

在端点上右键，选择 `RestfulToolkit: Copy as cURL`。

输出示例：

```bash
curl -X POST 'http://localhost:8080/api/users' -H 'Content-Type: application/json' -d '{"name": "", "email": ""}'
```

命令会按需包含 HTTP 方法、完整 URL、请求头和请求体，可导入 Postman、Bruno 或 Insomnia。

### 从 JSON 生成 DTO 类

在资源管理器中右键文件夹，选择 `RestfulToolkit: Generate DTO Class from JSON`。

生成器支持：

- Java 和 Kotlin 输出
- 嵌套对象和数组
- 使用 `@JsonProperty` 保留原始 JSON key
- Java DTO 可选 Lombok 模式

## 配置

RestfulToolkit 按以下优先级读取配置：

1. VS Code 工作区设置
2. 工作区根目录下的 `.restful-toolkit.json`
3. 内置默认值

| VS Code 设置 | 类型 | 默认值 | 说明 |
|--------------|------|--------|------|
| `restfulToolkit.scanPaths` | `array` | `["**/src/main/java/**/*.java", "**/src/main/kotlin/**/*.kt"]` | 需要扫描的 glob 模式 |
| `restfulToolkit.excludePaths` | `array` | `["**/src/test/**", "**/target/**", "**/build/**", ...]` | 需要排除的 glob 模式；watcher 按文件所属工作区的相对路径匹配 |
| `restfulToolkit.maxResults` | `number` | `100` | 最大搜索结果数，限制为 1-1000 |
| `restfulToolkit.copyNameFormat` | `string` | `"camelCase"` | 复制参数时默认使用的命名风格 |
| `restfulToolkit.baseUrl` | `string` | `""` | URL/cURL 生成使用的 Base URL；留空时自动检测 |

项目配置示例：

```json
{
  "scanPaths": [
    "**/src/main/java/**/*.java",
    "**/src/main/kotlin/**/*.kt"
  ],
  "excludePaths": [
    "**/src/test/**",
    "**/target/**",
    "**/build/**"
  ],
  "maxResults": 100
}
```

## 已知限制

- 无法检测从父类继承的端点注解。
- 无法解析 `${api.path}` 这类路由占位符。
- 无法检测通过 `@Configuration` 类注册的路由。
- Kotlin 字符串模板支持有限。
- 不会评估 `@ConditionalOnProperty` 等条件注解。

对典型 Spring Boot 项目的预期端点检测准确率约为 80-85%。

## 故障排查

| 问题 | 建议 |
|------|------|
| 没有找到端点 | 检查 `scanPaths`，然后运行 `RestfulToolkit: Refresh Endpoints` 并选择全量刷新 |
| 生成的 URL 主机或端口不正确 | 设置 `restfulToolkit.baseUrl`，或检查 `application.yml` / `application.properties` |
| DTO 字段没有展开 | 确认 DTO 类在工作区内，并且 Controller 源文件能通过 import 解析到它 |
| 搜索结果看起来过期 | 运行 `RestfulToolkit: Refresh Endpoints` |
| 需要诊断信息 | 打开 Output 面板并选择 RestfulToolkit 输出通道 |

## 开发

```bash
npm install
npm run compile
npm test
npm run build
```

额外验证脚本：

```bash
node src/test/scripts/test-parameter-copy.js
node src/test/scripts/test-copy-url-curl.js
node src/test/scripts/test-all-files.js
node src/test/scripts/test-json-to-class.js
```

## 路线图

- 支持 Micronaut 和 Quarkus
- 集成 Spring Boot Actuator
- 在 VS Code 内执行 HTTP 请求
- Services 树视图
- 更好的继承关系和配置类路由支持

## 许可证

MIT。详见 [LICENSE](LICENSE)。
