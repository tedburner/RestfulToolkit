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
- **运行所有测试**: `npm test` - Mocha 测试（解析器和缓存）
- **单元测试位置**: `src/test/` - Parser 测试（SpringMvcParser, JaxRsParser）和缓存测试

**参数复制批量测试**:
- **运行**: `node test-project/scripts/test-parameter-copy.js`
- **覆盖**: 75 个测试（Spring 解析 26、JAX-RS 解析 10、DTO 提取 17、格式转换 12、文件完整性 10）

**自动化验证脚本**:
- **运行验证**: `node test-project/scripts/test-all-files.js`
- **验证位置**: `test-project/scripts/test-all-files.js`
- **验证内容**: 49个端点、行号准确性100%、多路径拆分、Kotlin支持、框架分布统计

**VS Code功能测试**:
- 详见 `docs/TESTING_GUIDE.md`

### 发布与部署

**准备工作**:
1. 获取 Personal Access Token (PAT): https://dev.azure.com/ → 用户设置 → Personal access tokens
2. 登录 publisher: `vsce login kiturone`（输入PAT）
3. 或设置环境变量: `export VSCE_PAT="your-pat"`

**发布命令**:
- **直接发布当前版本**: `vsce publish` - 发布 package.json 中的版本
- **升级patch版本并发布**: `vsce publish patch` - 自动升级版本号（0.0.2 → 0.0.3）并发布
- **升级minor版本并发布**: `vsce publish minor` - 0.0.2 → 0.1.0
- **升级major版本并发布**: `vsce publish major` - 0.0.2 → 1.0.0
- **指定版本发布**: `vsce publish 0.0.3` - 发布指定版本
- **使用已打包文件**: `vsce publish --packagePath restful-toolkit-0.0.2.vsix`

**发布流程自动化**:
- 自动执行 `npm version`
- 自动创建 Git commit 和 tag
- 自动更新 package.json
- 自动打包成 VSIX
- 自动上传到 Marketplace

**发布选项**:
- **跳过已存在版本**: `vsce publish --skip-duplicate`
- **发布预发布版**: `vsce publish --pre-release`
- **自定义commit消息**: `vsce publish patch -m "Fix bug"`
- **不创建Git tag**: `vsce publish --no-git-tag-version`

**发布验证**:
- Marketplace: https://marketplace.visualstudio.com/items?itemName=kiturone.restful-toolkit
- VS Code搜索: 扩展视图搜索 "RestfulToolkit"
- 通常5-10分钟后可见

**首次发布**:
```bash
# 1. 登录publisher（保存PAT）
vsce login kiturone

# 2. 发布
vsce publish
```

**后续升级**:
```bash
# 自动升级版本并发布
vsce publish patch
```

**打包不发布**:
- `vsce package` - 仅生成VSIX文件，不上传
- 输出: `restful-toolkit-{version}.vsix`

### 扩展开发
- **F5 调试**: 在 VS Code 中按 F5 启动扩展开发宿主
- **打包扩展**: `vsce package` - 创建 `.vsix` 安装文件
- **本地安装**: 通过 VS Code 扩展视图安装 `.vsix` 文件

## 架构概览

### 核心组件流程

**扫描层** (`src/scanner/FileScanner.ts`):
- 使用 ConfigManager 提供的 glob 模式扫描工作区文件
- 文件扫描防抖（500ms 延迟）用于实时更新
- 扫描期间显示状态栏进度

**解析层** (`src/parsers/AnnotationParser.ts`):
- 协调 SpringMvcParser 和 JaxRsParser
- 提取类块并解析注解
- Kotlin 预处理以处理字符串模板

**Spring MVC 解析器** (`src/parsers/SpringMvcParser.ts`):
- 解析 `@RequestMapping`, `@GetMapping`, `@PostMapping` 等
- 处理多路径注解：`@GetMapping({"/users", "/list"})`
- 类级别 + 方法级别路径组合

**JAX-RS 解析器** (`src/parsers/JaxRsParser.ts`):
- 解析 `@Path`, `@GET`, `@POST` 等
- 类级别 + 方法级别路径组合逻辑

**缓存层** (`src/cache/EndpointCache.ts`):
- 双索引：按端点路径和按文件路径
- 模糊搜索加权评分（路径 40%，类名 30%，方法名 20%，HTTP 方法 10%）
- 文件变更/删除时实时更新

**UI 层** (`src/ui/SearchUI.ts`):
- QuickPick 界面，彩色 HTTP 方法图标
- 搜索结果按匹配评分过滤和排序
- 打开文件并跳转到精确行号

**参数提取层** (`src/extractor/`):
- **ParameterExtractor.ts** — 入口：检测框架、查找方法、解析参数、解析 DTO 字段
- **SpringParameterParser.ts** — Spring 注解参数解析（@RequestParam, @PathVariable, @RequestBody 等），跟踪括号深度
- **JaxRsParameterParser.ts** — JAX-RS 注解参数解析（@PathParam, @QueryParam, @FormParam）
- **DtoFieldExtractor.ts** — 异步嵌套 DTO 字段提取（最多 3 层，循环引用保护），支持 @JsonProperty/@JsonAlias/@JSONField/@JsonNaming，支持泛型集合（List\<T\>、Set\<T\>、Map\<K,V\>）内嵌 DTO 解析
- **FormatConverter.ts** — 格式转换：URL Params、JSON Body（body 参数展开）、Form Data（form 参数展开）、x-www-form-urlencoded
- **i18n.ts** — 格式标签翻译

**命令层** (`src/commands/`):
- **CopyEndpointParametersCommand.ts** — 右键菜单命令：自动检测输出格式和命名风格，QuickPick 选择后写入剪贴板

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
- 文件变更时自动刷新缓存

## OpenSpec 工作流

**模式**: 规范驱动（proposal → specs → design → tasks）

**关键命令**:
- `/opsx:explore` - 进入探索模式，在创建变更前思考、调查和明确需求
- `/opsx:propose <name>` - 一步创建完整变更提案及所有产物
- `/opsx:apply <name>` - 实现变更的任务
- `/opsx:archive <name>` - 归档已完成的变更

**OpenSpec CLI 命令**:
- `openspec new change "<name>"` - 创建脚手架变更目录
- `openspec list` - 列出活跃变更
- `openspec list --specs` - 列出规范
- `openspec status --change "<name>" --json` - 获取产物状态和依赖
- `openspec instructions <artifact> --change "<name>" --json` - 获取产物创建指导
- `openspec archive "<name>"` - 归档已完成的变更

## 项目结构

```
openspec/
├── config.yaml          # 项目上下文和产物规则
├── changes/             # 活跃变更提案
│   └── archive/         # 已归档的完成变更
└── specs/               # 规范文档

.claude/
├── skills/              # 自定义 OpenSpec skills
│   ├── openspec-explore/
│   ├── openspec-propose/
│   ├── openspec-apply-change/
│   └── openspec-archive-change/
└── commands/            # 自定义斜杠命令 (opsx)

src/
├── extension.ts           # 扩展入口
├── cache/                 # 端点缓存（EndpointCache）
├── commands/              # VS Code 命令（CopyEndpointParametersCommand）
├── config/                # 配置管理（ConfigManager, ScanConfig）
├── extractor/             # 参数提取（ParameterExtractor, SpringParameterParser, JaxRsParameterParser, DtoFieldExtractor, FormatConverter, i18n）
├── models/                # 类型定义（RestEndpoint, SearchQuery, EndpointCopyInfo, DtoField）
├── parsers/               # 注解解析器（Spring MVC, JAX-RS）
├── scanner/               # 文件扫描器
├── ui/                    # QuickPick 搜索界面
├── utils/                 # 文件监视、日志
└── test/                  # Mocha 单元测试
```

## 工作流使用

**开始新工作**:
1. 使用 `/opsx:explore` 思考需求和设计
2. 使用 `/opsx:propose <change-name>` 创建完整变更及所有产物
3. 使用 `/opsx:apply <change-name>` 实现任务
4. 完成后使用 `/opsx:archive <change-name>`

**创建产物**:
- propose skill 按依赖顺序自动处理所有产物创建
- 每个产物有 schema 定义依赖
- CLI instructions 的上下文和规则指导写作但不应出现在输出文件
- 创建新产物前阅读依赖产物

**实现变更**:
- apply skill 在实现前阅读上下文文件（proposal, specs, design, tasks）
- 任务按顺序执行，在 tasks.md 中标记每个完成 `[x]`
- 阻塞、需求不清或设计问题时暂停 - 不要猜测
- 保持变更最小化并限定在每个任务范围

## 配置文件格式

`.restful-toolkit.json` 示例：

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

提交到 Git 供团队共享配置。

## Glob 模式说明

| 模式 | 说明 | 示例 |
|------|------|------|
| `**` | 匹配任意层级目录 | `**/src/main/java` → 匹配所有 src/main/java |
| `*` | 匹配单层任意字符 | `*.java` → 匹配所有 Java 文件 |
| `**/*.java` | 匹配任意层级下的 Java 文件 | 所有目录下的 Java 文件 |

**多模块项目**: 必须使用 `**/src/main/java` 而非 `src/main/java` 才能扫描子模块。

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