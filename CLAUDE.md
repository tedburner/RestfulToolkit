# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供在本仓库工作的指导。

## 项目概述

RestfulToolkit 是一个 VS Code 扩展，用于搜索和导航 Java/Kotlin Spring 和 JAX-RS 项目中的 RESTful API 端点。本项目使用 OpenSpec (v1.3.0) 进行规范驱动开发。

## 开发命令

### 构建与编译
- **生产构建**: `npm run build` - Webpack 打包至 `dist/extension.js`
- **TypeScript 编译**: `npm run compile` - 直接编译 TypeScript
- **监视模式**: `npm run watch` - 开发时自动重新编译
- **代码检查**: `npm run lint` - 对 `src/**/*.ts` 运行 ESLint

### 测试

**单元测试（Mocha）**:
- **运行所有测试**: `npm test` - Mocha 测试（解析器、缓存、扫描器、UI、激活与工具）
- **单元测试位置**: `src/test/` - Parser、EndpointCache、FileScanner、SearchUI、BaseUrlResolver 与扩展激活测试

**参数复制批量测试**:
- **运行**: `node src/test/scripts/test-parameter-copy.js`
- **覆盖**: 78 个测试（Spring/JAX-RS 解析、DTO 提取、格式转换、文件完整性）

**自动化验证脚本**:
- **运行验证**: `node src/test/scripts/test-all-files.js`
- **验证位置**: `src/test/scripts/test-all-files.js`
- **验证内容**: 50个端点、行号准确性100%、多路径拆分、Kotlin支持、框架分布统计

**URL/cURL 自动化测试**:
- **运行**: `node src/test/scripts/test-copy-url-curl.js`
- **覆盖**: 115 个测试（URL 生成、cURL 转换、Base URL 解析、Header 端到端）

**VS Code功能测试**:
- 详见 `docs/TESTING_GUIDE.md`

**Marketplace 统计脚本测试**:
- **运行**: `npm run test:marketplace-stats` - 验证 README 安装量徽章更新和缺失徽章报错

### 发布与部署

- 登录 publisher：`vsce login kiturone`，或设置 `VSCE_PAT`
- 发布当前版本：`vsce publish`；按语义版本升级：`vsce publish patch|minor|major`
- 仅打包：`vsce package`；发布已有包：`vsce publish --packagePath <file.vsix>`
- 常用选项：`--skip-duplicate`、`--pre-release`、`--no-git-tag-version`
- 发布后在 [Marketplace](https://marketplace.visualstudio.com/items?itemName=kiturone.restful-toolkit) 验证，并同步：
  - `README.md` / `README_CN.md` 版本徽章
  - `CHANGELOG.md` 版本标题与变更
  - `docs/DOCUMENTATION_MANIFEST.md` 版本引用
  - `.vscodeignore` 发布包排除项

### 扩展开发
- **F5 调试**: 在 VS Code 中按 F5 启动扩展开发宿主
- **打包扩展**: `vsce package` - 创建 `.vsix` 安装文件
- **本地安装**: 通过 VS Code 扩展视图安装 `.vsix` 文件

## 架构概览

### 核心组件流程

**扫描层** (`src/scanner/FileScanner.ts`):
- 使用 ConfigManager 提供的 glob 模式扫描工作区文件
- 合并 glob 为单次文件发现、限制并发并预筛选受支持 REST 注解
- 文件解析前后校验 `mtime + size`，仅在元数据稳定时同时提交端点缓存与扫描状态；扫描期间再次变化的文件保留旧缓存和重试资格
- 成功解析采用整体替换语义，空结果会清除旧端点
- 命令注册后后台执行首次扫描，索引期间搜索仍可用，扫描完成后按当前查询刷新 QuickPick
- 强制刷新在当前扫描后排队执行，当前轮异常也不会丢失；失败文件保留重试资格
- 工作区与 watcher 扫描共用状态记录；以内存中的 `mtime + size` 判断变化，删除文件同步清理扫描记录
- 停用时释放配置订阅，并等待配置重载与任意当前扫描安全收束
- 文件扫描防抖（500ms 延迟）用于实时更新
- 扫描期间显示状态栏进度

**解析层** (`src/parsers/AnnotationParser.ts`):
- 协调 SpringMvcParser 和 JaxRsParser
- 遮罩后代类型后分别解析类块，嵌套类端点归属和绝对行号保持准确
- Kotlin 预处理以处理字符串模板

**Spring MVC 解析器** (`src/parsers/SpringMvcParser.ts`):
- 解析 `@RequestMapping`, `@GetMapping`, `@PostMapping` 等
- 类级路径限定在类型声明前；方法声明使用结构扫描而非固定字符窗口
- 处理多路径注解：`@GetMapping({"/users", "/list"})`
- 类级别 + 方法级别路径组合

**JAX-RS 解析器** (`src/parsers/JaxRsParser.ts`):
- 解析 `@Path`, `@GET`, `@POST` 等
- 类级 `@Path` 限定在类型声明前，避免复用方法级路径
- 方法注解块保留精确字符偏移，重复注解文本仍能定位到各自方法行
- 类级别 + 方法级别路径组合逻辑

**缓存层** (`src/cache/EndpointCache.ts`):
- 双索引：按端点路径和按文件路径
- 模糊搜索加权评分（路径 40%，类名 30%，方法名 20%，HTTP 方法 10%）
- 预计算搜索字段并使用稳定有界堆维护 top-K 候选；多词评分流式聚合，重复文本 token 仅处理一次且不改变匹配与排序契约
- 文件变更/删除时实时更新

**UI 层** (`src/ui/SearchUI.ts`):
- QuickPick 界面，彩色 HTTP 方法图标
- 搜索结果按匹配评分过滤和排序
- 索引期间显示 busy 状态，初始与查询结果均受 `maxResults` 限制；完成后刷新当前查询，无端点时关闭并提示
- 打开文件并跳转到精确行号

**参数提取层** (`src/extractor/`):
- **ParameterExtractor.ts** — 入口：检测框架、查找方法（含类级路径拼接）、解析参数、解析 DTO 字段
- **SpringParameterParser.ts** — Spring 注解参数解析（@RequestParam, @PathVariable, @RequestBody, @RequestHeader 等），跟踪括号深度
- **JaxRsParameterParser.ts** — JAX-RS 注解参数解析（@PathParam, @QueryParam, @FormParam, @HeaderParam）
- **DtoFieldExtractor.ts** — 异步嵌套 DTO 字段提取（最多 3 层，循环引用保护），支持 @JsonProperty/@JsonAlias/@JSONField/@JsonNaming，支持泛型集合（List\<T\>、Set\<T\>、Map\<K,V\>）内嵌 DTO 解析
- **FormatConverter.ts** — 格式转换：URL Params、JSON Body（body 参数展开）、Form Data（form 参数展开）、x-www-form-urlencoded
- **UrlGenerator.ts** — 完整 URL 生成（Base URL + 路径 + 查询参数）
- **CurlConverter.ts** — cURL 命令生成（方法 + URL + 请求头 + 请求体）
- **i18n.ts** — 格式标签翻译

**命令层** (`src/commands/`):
- **CopyEndpointParametersCommand.ts** — 右键菜单命令：自动检测输出格式和命名风格，QuickPick 选择后写入剪贴板
- **CopyUrlCommand.ts** — 复制完整端点 URL
- **CopyCurlCommand.ts** — 复制 cURL 命令（可直接导入 Postman/Bruno/Insomnia）

### 配置系统 (`src/config/`)

**关键点**: 所有默认配置在 `ScanConfig.ts` 的 `DEFAULT_CONFIG` 中定义，避免多处维护。

**ScanConfig.ts** - 默认值的唯一来源:
- `DEFAULT_CONFIG` 包含支持多模块项目的 glob 模式
- 配置接口和常量定义
- **重要**: 使用 `**/src/main/java` 模式（不是 `src/main/java`）以支持多模块 Maven 项目

**ConfigManager.ts** - 三级优先级系统:
1. VS Code 工作区设置（最高）
2. 项目配置文件 `.restful-toolkit.json`
3. DEFAULT_CONFIG（最低）

**使用模式**: 始终使用 `ConfigManager.getInstance().getScanConfig()` 而非硬编码后备值。

### 文件监视 (`src/utils/FileWatcher.ts`)
- VS Code FileSystemWatcher 用于实时更新
- onCreate, onChange, onDelete 回调
- 文件变更时自动整体替换缓存，并在调度前对绝对路径和所属工作区相对路径应用 `excludePaths`
- Base URL 配置 watcher 仅覆盖 `main/resources` 下的 application/bootstrap 配置

### Base URL 解析 (`src/utils/BaseUrlResolver.ts`)
- 自动检测 `application.yml` / `application.properties` 中的 `server.port` 和 `server.servlet.context-path`
- 支持 `bootstrap.yml` / `bootstrap.properties`（Spring Cloud，优先级高于 application）
- 支持 `application-{profile}.yml` 多环境配置覆盖
- 支持占位符解析：`${SERVER_PORT:8080}` → `8080`
- 仅通过 VS Code 异步文件系统发现和读取配置，不提供同步解析入口
- 按工作区使用纯内存缓存；Spring 配置文件事件主动使所属工作区缓存失效
- 异步解析通过工作区版本令牌避免失效后回填陈旧结果
- 配置文件优先级：application（基础）→ bootstrap（高）→ application-{profile}（最高）

## OpenSpec 工作流

- 模式：`proposal → specs → design → tasks → apply → archive`
- 命令：`/opsx:explore`、`/opsx:propose <name>`、`/opsx:apply <name>`、`/opsx:archive <name>`
- CLI：`openspec list`、`openspec status --change <name> --json`、`openspec instructions <artifact> --change <name> --json`
- 创建产物前读取依赖产物；实现时按顺序完成并勾选 `tasks.md`，遇到需求或设计阻塞时暂停确认

## 项目结构

```
openspec/changes/         # 活跃与归档变更
openspec/specs/           # 已生效规范
.claude/skills/           # 项目 OpenSpec skills
src/cache/                # 端点缓存与内存扫描状态
src/config/               # 配置与 Base URL 调用入口
src/parsers/              # Spring MVC / JAX-RS 注解解析
src/scanner/              # 工作区与 watcher 扫描
src/extractor/            # 参数和 DTO 提取
src/commands/             # VS Code 命令
src/ui/                   # QuickPick 搜索界面
src/utils/                # watcher、日志、Base URL 解析
src/test/                 # Mocha 与自动化验证
```

## 配置文件格式

- 工作区根目录可提交 `.restful-toolkit.json` 共享 `scanPaths`、`excludePaths`、`maxResults`、`baseUrl`
- 多模块项目必须使用 `**/src/main/java` / `**/src/main/kotlin` 前缀
- 完整格式、优先级与示例见 `docs/CONFIG_SYSTEM.md`

## CHANGELOG 格式规范

- 标题使用 `## [版本号] - 日期`
- 英文条目以 `Added` / `Changed` / `Fixed` 开头，`---` 后写对应中文条目
- 每条只写一种语言，合并同类小改动，避免罗列实现噪音

## 已知限制

1. **继承关系**: 无法检测从父类继承的端点
2. **属性占位符**: 无法解析 `${api.path}` 等占位符
3. **配置类路由**: 无法检测通过 `@Configuration` 配置的路由
4. **Kotlin 字符串模板**: 对 Kotlin 字符串模板支持有限
5. **条件注解**: 无法评估影响端点可用性的条件注解

**预期准确率**: 对典型 Spring Boot 项目约 80-85% 端点检测率。

## 行为规范

### 自动同步文档

每次完成代码变更后，必须自动执行 `/neat-freak`，更新以下文件以保持知识体系一致：
- **CLAUDE.md** — Agent 开发指导（路由、架构、已知限制）
- **CHANGELOG.md** — 版本变更日志
- **README.md / README_CN.md** — 功能描述、已知限制、路线图
- **docs/DOCUMENTATION_MANIFEST.md** — 目录与文档清单

**目标**: 不留下过期信息、不留下相对时间、不留下已完成待办。
