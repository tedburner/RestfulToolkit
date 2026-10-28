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
- **运行所有测试**: `npm test` - Mocha 测试（解析器、缓存、扫描器、配置、工具、参数提取、复制命令、JSON 生成）
- **单元测试位置**: `src/test/` - Parser 测试（SpringMvcParser, JaxRsParser）、缓存与扫描状态测试、FileScanner 扫描与并发时序测试、ConfigManager 配置测试、复制命令测试、工具与生成器测试

**参数复制批量测试**:
- **运行**: `node src/test/scripts/test-parameter-copy.js`
- **覆盖**: 78 个测试（Spring 解析、JAX-RS 解析、DTO 提取、格式转换、文件完整性）

**自动化验证脚本**:
- **运行验证**: `node src/test/scripts/test-all-files.js`
- **验证位置**: `src/test/scripts/test-all-files.js`
- **验证内容**: 53个端点、行号准确性100%、多路径拆分、Kotlin支持、框架分布统计

**URL/cURL 自动化测试**:
- **运行**: `node src/test/scripts/test-copy-url-curl.js`
- **覆盖**: 113 个测试（URL 生成、cURL 转换、Base URL 解析、Header 端到端）

**cURL 语义验证**:
- **运行**: `npm run test:curl-semantic`（或 `node src/test/scripts/test-curl-semantic.js`）
- **覆盖**: 17 项验证——用真实 curl 进程把生成的命令发送到本地 HTTP 接收端，核对实际请求的 HTTP 方法、查询参数、Content-Type、JSON/urlencoded 正文、multipart 分段与 Shell 单引号转义往返；Windows 或 curl 缺失时报告 SKIP 并以 0 退出

**JSON 生成编译冒烟**:
- **运行**: `npm run test:dto-compile`（或 `node src/test/scripts/test-dto-compile.js`）
- **覆盖**: 22 项验证——保留字与重名字段、嵌套类不与根类同名、空数组与可空类型按目标语言渲染；javac 可用时对生成的 Java 源码配合离线 JsonProperty 注解 stub 做真实编译，kotlinc 可用时编译 Kotlin，工具链缺失时保留结构断言

**脚本共享 lib**（`src/test/scripts/lib/`）:
- `dist-check.js` — 批量脚本前置检查：dist 编译产物落后于 src 生产源码时拒绝运行并提示先 `npm run compile`（`SKIP_DIST_CHECK=1` 可跳过）
- `copy-info-fixture.js` — 与 Mocha 侧一致的 `makeCopyInfo` EndpointCopyInfo 夹具

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
- `.vscodeignore` 必须排除 `.kapibala/**` 等本地 Agent 历史目录，避免将工作区数据打进 VSIX

### 扩展开发
- **F5 调试**: 在 VS Code 中按 F5 启动扩展开发宿主
- **打包扩展**: `vsce package` - 创建 `.vsix` 安装文件
- **本地安装**: 通过 VS Code 扩展视图安装 `.vsix` 文件

## 架构概览

### 核心组件流程

**扫描层** (`src/scanner/FileScanner.ts`):
- 使用 ConfigManager 提供的 glob 模式扫描工作区文件；多根工作区按每个根目录各自的 scanPaths/excludePaths 用 RelativePattern 独立发现，再统一按标准化路径去重
- 工作区扫描在收集完一批解析结果后经版本校验批量提交（`EndpointCache.updateFiles`），一轮扫描只重建一次全量端点数组
- `needsScan` 文件状态检查与文件解析都使用扫描并发上限，避免大仓库瞬时打满文件系统
- 读取文件后先执行受支持 REST 注解预筛选，普通 Java/Kotlin 类不进入完整解析器
- 文件解析前后校验 `mtime + size`，仅在元数据稳定时提交端点缓存与扫描状态；扫描期间再次变化的文件保留旧缓存和重试资格
- 每文件维护版本令牌：`removeFile` 与增量对账推进版本，在途扫描提交前校验版本，删除事件不会被旧结果覆盖
- 每次成功解析都整体替换该文件缓存，空结果会清除已删除的旧端点
- 解析器显式区分失败与成功空结果；失败保留最近一次成功缓存并保留重试资格
- 发现结果对账：扫描结束后比对扫描记录和缓存文件索引，清理确定已移除的文件；每根 scanPaths 为空的范围视为未知并保留，全量刷新也保留旧快照直到结果提交
- watcher 防抖事件并入共享有界队列：同文件合并待执行任务、不重叠提交；工作区扫描与在途 watcher 任务相互等待，共用并发上限
- 扩展先注册命令再后台启动首次扫描，索引期间仍可搜索当前已发现端点，扫描完成后按当前查询刷新 QuickPick
- 强制刷新在当前扫描后排队执行，当前轮异常也不会丢失
- `waitForIdle` 同时等待工作区扫描与 watcher 队列收束
- `.restful-toolkit.json` 创建、修改或删除会重载项目配置、重建 watcher 并触发全量刷新

**解析层** (`src/parsers/AnnotationParser.ts`):
- 协调 SpringMvcParser 和 JaxRsParser
- 文件级净化文本复用传入各解析入口，每文件只 sanitize 一次
- 用栈建立类型包含关系，仅遮罩每个块的直接子类型区间（孙辈已包含在内），单次字符遍历完成遮罩，确保嵌套类端点只归属声明它的类
- 复用文件级行索引与绝对字符偏移，保持嵌套类行号准确
- Kotlin 预处理以处理字符串模板
- `parseFileResult` 显式返回完整解析状态；扫描器不会把异常折叠为成功空端点

**Spring MVC 解析器** (`src/parsers/SpringMvcParser.ts`):
- 解析 `@RequestMapping`, `@GetMapping`, `@PostMapping` 等
- 方法级 Spring mapping 注解使用单次源码顺序扫描，避免按注解类型多轮扫描造成顺序漂移
- 类级路径返回完整集合（`parseClassLevelPaths`），与方法级多路径做笛卡尔积；`@RequestMapping({"/api", "/v2"})` 会生成全部组合
- 注解范围与参数区都在词法安全文本上配对括号：路径字符串内的括号（如 `"/a(b"`）不破坏提取，注解名与左括号之间允许空白
- 类级路径只从类型声明前的注解区提取；方法声明使用结构扫描，不依赖固定字符窗口
- 方法级路径为空时使用类级路径；没有类级路径时索引根路径 `/`

**JAX-RS 解析器** (`src/parsers/JaxRsParser.ts`):
- 解析 `@Path`, `@GET`, `@POST` 等
- 方法扫描限定在类型直接成员层级：匹配"返回类型 + 名称 + 参数列表"后按 `;`（接口/抽象方法）或 `{`（方法体）终结，并跳过整个方法体，方法体内的调用不会产生幻影端点
- 声明扫描支持 Java/Kotlin 泛型类型参数（`public <T> Response g()`、`fun <T> foo()`）与 Kotlin 显式/可空返回类型（`fun a(): String?`）；被跳过成员（如 Kotlin 表达式函数体）的注解不会泄漏给下一个方法
- 方法注解以字符范围整体提取（保留跨行注解原文）并携带精确绝对偏移，重复注解文本不会复用前一个方法的跳转行号
- 类级 `@Path` 只从类型声明前提取，避免复用方法级路径
- 类级别 + 方法级别路径组合逻辑

**缓存层** (`src/cache/EndpointCache.ts`):
- 双索引：按端点路径和按文件路径
- 模糊搜索加权评分（路径 40%，类名 30%，方法名 20%，HTTP 方法 10%）
- 端点加入缓存时预计算小写文本、camelCase/分隔符词段和首字母缩写；搜索时使用稳定有界堆维护 top-K，并流式聚合多词评分、去重重复文本 token，在不改变匹配和排序契约的前提下减少临时分配
- 批量文件更新走 `updateFiles`：一批变更只重建一次全量数组与索引，保持"未涉及文件原顺序、新端点按更新顺序追加"的顺序契约

**UI 层** (`src/ui/SearchUI.ts`):
- QuickPick 界面，彩色 HTTP 方法图标
- 搜索结果按匹配评分过滤和排序；空查询与有查询共用有界搜索入口，首屏只克隆前 K 条
- 首次条目与查询结果都遵守 `maxResults`；后台索引期间以 busy 状态展示当前结果，完成后刷新当前查询，无端点时关闭并提示
- 打开文件并跳转到精确行号

**参数提取层** (`src/extractor/`):
- `ParameterExtractor` 协调 Spring/JAX-RS 参数解析、方法定位和 DTO 字段提取；方法定位返回结构化参数字符范围（净化文本括号配对 + 原文截取），mapping 注解不再拼入"签名"
- Java/Kotlin 参数解析各自识别 `Type name` 与 `name: Type` 声明；`extract` 支持 `expandDto: false` 跳过 DTO 递归展开，`expandDtoFields` 供命令在选定格式后延迟展开
- 复制命令从当前编辑器文本调用共享注解解析器获取路由与 HTTP 方法，支持 package-private Java 和 Kotlin 方法
- `DtoFieldExtractor` 异步展开最多 3 层 DTO，支持常见 JSON 命名注解、泛型集合、按递归分支循环保护和单命令生命周期缓存
- `FormatConverter`、`UrlGenerator` 负责复制格式与完整 URL；`CurlConverter` 将 Spring 表单请求中的 `@RequestParam` 默认作为表单字段（源码无法区分 URL 与表单来源），正文输出 JSON、urlencoded 或 multipart（由 curl 生成 boundary）

**JSON 转 DTO** (`src/generator/`):
- `JsonClassGenerator` 按目标语言分配合法字段名：规避对应语言硬关键字与同作用域重名（冲突追加计数后缀），原始 JSON key 保留在 `@JsonProperty` 注解
- `JsonTypeMapper` 类型推断贯穿目标语言，Kotlin 对 null/空数组输出 `Any?`/`List<Any?>` 等可空类型；嵌套类名与根类及其他生成类名均不重复

**命令层** (`src/commands/`):
- **CopyEndpointParametersCommand.ts** — 右键菜单命令：自动检测输出格式和命名风格，QuickPick 选择后写入剪贴板；取消或选择不需要 DTO 的格式不做 DTO 文件 I/O
- **CopyUrlCommand.ts** — 复制完整端点 URL（跳过 DTO 展开）
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

**使用模式**: 始终使用 `ConfigManager.getInstance().getScanConfig()` 而非硬编码后备值。资源相关命令传入资源 URI，使多根工作区的标量设置按所属文件夹解析；工作区扫描与 watcher 通过 `getFolderScanConfigs()` 按每个根目录独立合成 scanPaths/excludePaths（folder 级 VS Code 设置 → 该根项目配置 → 默认值），各根互不合并。项目配置异步加载到局部 Map 后按加载版本一次性原子替换共享快照，过期读取不会混入。

### 扩展生命周期 (`src/extension.ts`)

- 配置重载请求合并执行（一次进行 + 一次排队，当前轮失败后仍执行排队请求）；仅 `scanPaths`/`excludePaths` 或项目配置、工作区目录变化触发重载与全量刷新，`maxResults`/`baseUrl` 等实时读取的设置变化不触发重扫
- watcher 按根目录作用域创建（`FileWatcher.start(scopes)`），排除规则只作用于所属根

### 文件监视 (`src/utils/FileWatcher.ts`)
- VS Code FileSystemWatcher 用于实时更新，带 folderUri 的作用域使用 RelativePattern 限定根目录
- onCreate, onChange, onDelete 回调
- 文件变更时自动整体替换缓存，并在调度前对绝对路径和所属工作区相对路径应用该作用域的 `excludePaths`
- Spring Base URL 配置 watcher 限定为 `**/main/resources/{application,application-*,bootstrap}.{yml,yaml,properties}`
- 项目配置 watcher 监听 `**/.restful-toolkit.json` 并触发配置重载与端点刷新

### Base URL 解析 (`src/utils/BaseUrlResolver.ts`)
- 自动检测 `application.yml` / `application.properties` 中的 `server.port` 和 `server.servlet.context-path`
- 支持 `bootstrap.yml` / `bootstrap.properties`（Spring Cloud，优先级高于 application）
- 支持 `application-{profile}.yml` 多环境配置覆盖
- 支持占位符解析：`${SERVER_PORT:8080}` → `8080`
- 仅通过 VS Code 异步文件系统发现和读取配置，不提供同步解析入口
- 按工作区缓存配置发现与解析结果；配置文件事件主动使所属工作区缓存失效，版本令牌阻止旧异步结果回填；冷缓存期间同版本的并发请求复用同一个在途 Promise，失效后的新请求不复用旧 Promise
- 缓存仅存在于 Extension Host 内存中，不写入本地存储
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
.agents/skills/           # 项目 OpenSpec skills
src/cache/                # 端点缓存与内存扫描状态
src/config/               # 配置与 Base URL 调用入口
src/parsers/              # Spring MVC / JAX-RS 注解解析
src/scanner/              # 工作区与 watcher 扫描
src/extractor/            # 参数和 DTO 提取
src/generator/            # JSON 转 Java/Kotlin DTO 生成
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
5. **Kotlin 表达式函数体**: `fun e() = service()` 形式的端点暂不识别，其注解也不会影响相邻方法
6. **条件注解**: 无法评估影响端点可用性的条件注解

**预期准确率**: 对典型 Spring Boot 项目约 80-85% 端点检测率。

## 行为规范

### 自动同步文档

每次完成代码变更后，必须自动执行 `/neat-freak`，更新以下文件以保持知识体系一致：
- **CLAUDE.md** — Agent 开发指导（路由、架构、已知限制）
- **CHANGELOG.md** — 版本变更日志
- **README.md / README_CN.md** — 功能描述、已知限制、路线图
- **docs/DOCUMENTATION_MANIFEST.md** — 目录与文档清单

**目标**: 不留下过期信息、不留下相对时间、不留下已完成待办。
