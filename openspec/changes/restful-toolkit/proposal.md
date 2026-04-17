## Why

Java/Spring 开发人员在开发 RESTful API 项目时，需要快速根据 API 路径定位到对应的 Controller 方法。目前，查找处理特定 REST 端点的具体方法需要手动在多个 Controller 文件中搜索，这不仅耗时而且效率低下。特别是在大型项目中，数百个端点分布在大量 Controller 类中，这个问题尤为突出。

本项目引入 RestfulToolkit，一个 VS Code 扩展，为 Java/Kotlin Spring 和 JAX-RS 项目提供 RESTful API 端点的即时搜索和导航功能。这解决了开发人员频繁需要在 API 文档/请求和实际实现代码之间跳转时的生产力瓶颈问题。

## What Changes

- **新建 VS Code 扩展**：RestfulToolkit Visual Studio Code 扩展
  - 提供 QuickPick 搜索界面用于 RESTful 端点搜索
  - 支持路径、类名、方法名和 HTTP 方法的模糊匹配
  - 实现即时跳转到 Controller 方法定义
  - 注册快捷键（Ctrl\ 或 Ctrl+Alt+N）

- **Java/Kotlin 文件扫描**：自动化扫描源文件提取 REST 端点元数据
  - 扫描工作区的 Java (.java) 和 Kotlin (.kt) 文件
  - 解析 Spring MVC 注解（@RequestMapping, @GetMapping, @PostMapping 等）
  - 解析 JAX-RS 注解（@Path, @GET, @POST 等）
  - 提取 HTTP 方法、路径、类名、方法名、文件位置

- **实时更新**：文件变更检测和缓存更新
  - 扩展激活时进行初始扫描
  - 文件创建/修改/删除时增量更新
  - 维护端点缓存以实现快速搜索

- **代码导航**：跳转到方法定义功能
  - 在精确行号打开目标文件
  - 高亮显示 Controller 方法

## Capabilities

### New Capabilities

- `restful-search`: RESTful 端点快速搜索界面，支持模糊匹配和即时导航
- `file-scanning`: 自动化工作区扫描，从 Java/Kotlin 源文件提取 REST 端点元数据
- `annotation-parsing`: 解析 Spring MVC 和 JAX-RS 注解，提取 HTTP 方法和路径信息
- `code-navigation`: 从搜索结果跳转到 Controller 方法定义
- `cache-management`: 维护和更新端点元数据缓存，支持文件变更检测

### Modified Capabilities

<!-- 无现有能力被修改 - 这是一个全新项目 -->

## Impact

- **新建项目**：从零开始创建新的 VS Code 扩展
- **目标用户**：使用 Spring Boot、Spring MVC 或 JAX-RS 的 Java 和 Kotlin 开发人员
- **依赖项**：除了 VS Code 内置 API 外，无外部依赖
- **性能**：大型项目初始扫描可能需要几秒钟；缓存后搜索即时完成
- **准确性**：第一版预期能正确检测 80-85% 的端点；复杂场景（继承关系、配置文件中的动态路径）可能遗漏