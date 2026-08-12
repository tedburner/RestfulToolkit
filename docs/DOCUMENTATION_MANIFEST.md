# RestfulToolkit 文档与目录清单

## 整理完成 ✅

**整理日期**: 2026-04-20 | **更新日期**: 2026-08-12（扫描原子提交、索引完成刷新、重复 JAX-RS 注解行号与工作区相对排除规则）

**当前新增与更新（截至 2026-08-12）**:
- `src/scanner/FileScanner.ts` — 解析前后校验 `mtime + size`，仅在文件状态稳定时原子提交端点缓存与扫描记录
- `src/ui/SearchUI.ts` — 后台索引完成后按当前查询刷新已打开的 QuickPick，无端点时关闭并提示
- `src/parsers/JaxRsParser.ts` / `src/utils/FileWatcher.ts` — 重复注解块保留精确源码行号，watcher 支持工作区相对排除模式
- `docs/CODE_REVIEW_2026-07-29.md` — 本轮优化审查及逐项核验处置；R-2 至 R-7 中可执行项已修复，R-1/R-8 经评估暂不增加数据结构或配置复杂度
- `openspec/changes/fix-parser-and-scan-consistency/` — 解析器所有权/行号、增量扫描状态和 Base URL 异步化的中文 OpenSpec 设计、规格与任务
- `src/test/parsers/AnnotationParser.test.ts` / `src/test/cache/ScanStateManager.test.ts` — 类级路径、嵌套 Controller、绝对行号及 `mtime + size` 增量判断回归测试
- `docs/CODE_AUDIT_2026-06-01.md` — 全面代码审查报告，覆盖解析器、缓存/搜索、参数提取、扫描器/配置/工具层，含 6 个严重、5 个高级、12 个中级、16 个低级问题
- P0/P1 修复：恢复 TypeScript 编译，修复 Spring/JAX-RS 路径解析、搜索正则崩溃、JSON-to-DTO 覆盖确认与 `@JsonProperty` key 转义、项目配置安全校验、缓存计数漂移与扫描竞态
- 中低优先级小修：搜索输入防抖与实时清空、配置变化重建 watcher、Base URL YAML 层级约束、`maxResults` 约束、搜索 filters 应用、全限定 REST 注解识别、`@RequestMapping` 多 HTTP 方法解析
- `src/commands/JsonToClassCommand.ts` — JSON 转 DTO 命令（资源管理器文件夹右键）
- `src/generator/JsonClassGenerator.ts` / `src/generator/JsonTypeMapper.ts` — Java/Kotlin DTO 代码生成与类型映射
- `src/test/generator/JsonClassGenerator.test.ts` / `src/test/generator/JsonTypeMapper.test.ts` — JSON 转 DTO 单元测试
- `src/test/scripts/test-json-to-class.js` — JSON 转 DTO 批量验证脚本（86 测试）
- `src/test/scripts/mock-vscode.js` — Node 自动化脚本使用的最小 VS Code API mock
- `scripts/update-marketplace-stats.js` / `scripts/update-marketplace-stats.test.js` — Marketplace 安装量徽章同步脚本与回归测试
- `openspec/changes/optimize-startup-and-incremental-indexing/` — 启动、扫描、搜索和 Base URL 内存缓存优化的中文 OpenSpec 设计与任务
- `openspec/changes/optimize-search-hot-path/` — 保持搜索语义的流式评分聚合与重复 token 规范化 OpenSpec 设计、规格和任务
- `openspec/changes/simplify-equivalent-production-code/` — 行为保持不变的生产代码精简 OpenSpec 设计、规范与任务
- `src/test/extension.test.ts` / `src/test/ui/SearchUI.test.ts` / `src/test/utils/FileWatcher.test.ts` — 后台激活、索引中搜索、结果上限和 watcher 排除规则回归测试

**v0.0.4 新增**:
- `src/extractor/UrlGenerator.ts` — 完整 URL 生成
- `src/extractor/CurlConverter.ts` — cURL 命令生成
- `src/commands/CopyUrlCommand.ts` — 复制完整 URL 命令
- `src/commands/CopyCurlCommand.ts` — 复制 cURL 命令
- `src/utils/BaseUrlResolver.ts` — Base URL 自动检测（支持 bootstrap.yml、多环境 profile、占位符解析）
- `src/test/extractor/UrlGenerator.test.ts` — URL 生成测试（5 用例）
- `src/test/extractor/CurlConverter.test.ts` — cURL 生成测试（5 用例）
- `src/test/utils/BaseUrlResolver.test.ts` — Base URL 检测测试（24 用例）
- `package.nls.json` / `package.nls.zh-cn.json` — 新增 copyUrl/copyCurl 命令标题
- `src/extractor/ParameterExtractor.ts` — 增强 `findMethodAtPosition` 双策略扫描、括号深度签名匹配
- `src/extractor/DtoFieldExtractor.ts` — 提取 `PRIMITIVE_TYPES` 共享常量

---

## 一、目录结构概览

### 最终结构（最优状态）⭐⭐⭐⭐⭐

```
restful-toolkit/
├── 根目录文件 (14个)
│   ├── .eslintrc.json       # ESLint配置
│   ├── .gitignore           # Git忽略配置
│   ├── .vscodeignore        # VS Code打包配置
│   ├── CHANGELOG.md         # 版本变更日志
│   ├── CLAUDE.md            # Claude开发指导
│   ├── LICENSE              # MIT许可证
│   ├── README.md            # 英文主文档
│   ├── README_CN.md         # 中文主文档
│   ├── icon.png             # 扩展图标
│   ├── package.json         # 扩展配置
│   ├── package-lock.json    # npm依赖锁定
│   ├── package.nls.json     # 英文国际化文件
│   ├── package.nls.zh-cn.json # 中文国际化文件
│   ├── tsconfig.json        # TypeScript配置
│   └── webpack.config.js    # Webpack配置
│
├── src/ (源代码16个模块)
│   ├── extension.ts         # 扩展入口
│   ├── cache/               # 缓存管理（2模块）
│   ├── commands/            # 命令（4模块：CopyEndpointParameters, CopyUrl, CopyCurl, JsonToClass）
│   ├── config/              # 配置管理（2模块）
│   ├── extractor/           # 参数提取（8模块：FormatConverter, ParameterExtractor, SpringParameterParser, JaxRsParameterParser, DtoFieldExtractor, i18n, UrlGenerator, CurlConverter）
│   ├── generator/           # JSON 转 DTO 代码生成（2模块：JsonClassGenerator, JsonTypeMapper）
│   ├── models/              # 数据模型（1模块）
│   ├── parsers/             # 注解解析（3模块）
│   ├── scanner/             # 文件扫描（1模块）
│   ├── ui/                  # 用户界面（1模块）
│   ├── utils/               # 工具类（3模块：FileWatcher, Logger, BaseUrlResolver）
│   └── test/                # 单元测试（含 UrlGenerator, CurlConverter, BaseUrlResolver, JSON-to-DTO 测试）
│
├── docs/ (文档8个)
│   ├── CONFIG_SYSTEM.md     # 配置系统文档
│   ├── DOCUMENTATION_MANIFEST.md # 本清单
│   ├── INCREMENTAL_SCAN.md  # 增量扫描文档
│   ├── OPTIMIZATION_PLAN.md # 当前核心代码优化任务清单
│   ├── CODE_AUDIT_2026-06-01.md # 代码审查报告（待修复）
│   ├── CODE_REVIEW_2026-07-29.md # 本轮优化审查与处置结果
│   ├── TESTING_GUIDE.md     # 测试指南
│   └── screenshot.png       # 扩展截图演示
│
├── docs/superpowers/ (规范与设计)
│   ├── plans/               # 实现计划
│   │   └── 2026-04-27-endpoint-parameter-copy.md
│   └── specs/               # 设计规格
│       └── 2026-04-27-endpoint-parameter-copy-design.md
│
├── test-project/ (完整测试项目)
│   ├── README.md            # 测试项目说明
│   ├── TEST-COVERAGE-CHECKLIST.md # 测试覆盖清单
│   └── src/main/            # 测试Controller + DTO
│       └── java/com/example/
│           ├── controller/  # TestController, TestResource, FormController
│           └── dto/         # UserDto, OrderDto, AddressDto, SnakeCaseDto, AliasDto, LoginForm
│
├── src/test/scripts/ (自动化测试脚本)
│   ├── mock-vscode.js            # Node 脚本最小 VS Code API mock
│   ├── test-all-files.js         # 端点验证脚本（50端点）
│   ├── test-parameter-copy.js    # 参数复制批量测试（78测试）
│   ├── test-copy-url-curl.js     # URL/cURL 自动化测试（115测试）
│   └── test-json-to-class.js     # JSON 转 DTO 自动化测试（86测试）
│
├── openspec/ (OpenSpec规范 - 保持不变)
│   └── changes/restful-toolkit/
│
└── .claude/ (Claude配置 - 保持不变)
```

**评价**: ✅ 结构清晰，职责分明，无冗余，符合VS Code扩展标准

---

## 二、测试脚本结构

### 单元测试（Mocha框架）- 22个文件 ✅

**位置**: `src/test/` 目录

| 文件 | 说明 |
|------|------|
| runTest.ts | Mocha测试入口 |
| parsers/SpringMvcParser.test.ts | Spring解析器测试（含 @RequestHeader） |
| parsers/JaxRsParser.test.ts | JAX-RS解析器测试（含 @HeaderParam 与重复注解块精确行号） |
| parsers/AnnotationParser.test.ts | 类型级路径、嵌套 Controller 归属与绝对行号集成测试 |
| extractor/ParameterExtractor.test.ts | 多路径 mapping 的复制命令首路径选择规则测试 |
| cache/EndpointCache.test.ts | 缓存、搜索排序与预计算复用测试 |
| cache/ScanStateManager.test.ts | `mtime + size` 会话内增量判断测试 |
| scanner/FileScanner.test.ts | 文件扫描单次发现、并发限流、注解预筛选、扫描期间文件变化的原子提交、异常后排队强制刷新与状态栏 timer 所有权测试 |
| extension.test.ts | 命令先于后台扫描完成注册，以及停用等待配置重载和扫描收束的生命周期测试 |
| commands/CopyUrlCurlCommand.test.ts | Copy Full URL/Copy as cURL 的端点提取、Base URL 与剪贴板命令编排测试 |
| ui/SearchUI.test.ts | 索引中搜索、索引完成刷新/空结果提示与 QuickPick 结果上限测试 |
| utils/FileWatcher.test.ts | watcher 默认及工作区相对排除规则测试 |
| extractor/UrlGenerator.test.ts | URL 生成测试（5 用例） |
| extractor/CurlConverter.test.ts | cURL 生成测试（5 用例） |
| extractor/NameTransformer.test.ts | 命名转换测试 |
| extractor/FormatConverter.test.ts | 格式转换测试 |
| extractor/DtoFieldExtractor.test.ts | DTO 查找缓存与字段解析测试 |
| extractor/SpringParameterParser.test.ts | Spring 参数解析测试 |
| extractor/JaxRsParameterParser.test.ts | JAX-RS 参数解析测试 |
| utils/BaseUrlResolver.test.ts | Base URL 自动检测、发现复用、工作区级失效与异步失效竞态测试 |
| generator/JsonClassGenerator.test.ts | JSON 转 Java/Kotlin DTO 生成测试 |
| generator/JsonTypeMapper.test.ts | JSON 值到 Java/Kotlin 类型映射测试 |
| utils/TextProcessor.test.ts | 文本净化与行号索引测试 |

**运行**: `npm test`

### 自动化验证 - 4个脚本 + 1个 mock ✅

**位置**: `src/test/scripts/`

| 脚本 | 说明 | 运行 |
|------|------|------|
| test-all-files.js | 50个端点验证、行号准确性100%、多路径拆分、Kotlin支持 | `node src/test/scripts/test-all-files.js` |
| test-parameter-copy.js | 78个参数复制测试（Spring/JAX-RS解析、DTO提取、格式转换、文件完整性） | `node src/test/scripts/test-parameter-copy.js` |
| test-copy-url-curl.js | 115个测试（URL生成、cURL转换、Base URL解析、Header端到端） | `node src/test/scripts/test-copy-url-curl.js` |
| test-json-to-class.js | 86个测试（命名转换、类型推断、Java/Kotlin 生成、边界情况） | `node src/test/scripts/test-json-to-class.js` |
| mock-vscode.js | 为 Node 自动化脚本提供最小 VS Code API mock | 由脚本自动加载 |

---

## 三、文档清单

### 根目录文档 (5个) ✅

| 文档 | 说明 |
|------|------|
| README.md | 项目主文档（英文）|
| README_CN.md | 项目主文档（中文）|
| CHANGELOG.md | 版本变更日志 |
| AGENTS.md | Codex 与通用 Agent 开发指导 |
| CLAUDE.md | Claude开发指导 |

### docs目录 (8个) ✅

| 文档 | 说明 |
|------|------|
| TESTING_GUIDE.md | VS Code测试指南 |
| CONFIG_SYSTEM.md | 配置系统文档 |
| INCREMENTAL_SCAN.md | 增量扫描文档 |
| OPTIMIZATION_PLAN.md | 当前核心代码优化任务清单（2026-06-15，已完成） |
| CODE_AUDIT_2026-06-01.md | 代码审查报告（2026-06-01，P0/P1 已在 2026-06-02 优先修复） |
| CODE_REVIEW_2026-07-29.md | 解析器、扫描状态和 Base URL 优化审查及逐项处置结果 |
| DOCUMENTATION_MANIFEST.md | 本清单文档 |
| screenshot.png | 扩展截图演示 |
| superpowers/plans/2026-04-27-endpoint-parameter-copy.md | 参数复制功能实现计划 |
| superpowers/specs/2026-04-27-endpoint-parameter-copy-design.md | 参数复制功能设计规格 |

### test-project目录 (2个 + 测试代码) ✅

| 文档 | 说明 |
|------|------|
| README.md | 测试项目说明 |
| TEST-COVERAGE-CHECKLIST.md | 测试覆盖清单 |

**测试 Controller**（3个）：TestController（Spring 25端点）、TestResource（JAX-RS 11端点）、FormController（@ModelAttribute）
**测试 DTO**（7个）：UserDto, OrderDto, AddressDto, SnakeCaseDto, AliasDto, LoginForm, NameLombokDTO

### openspec目录 (14个) - 保持不变 ✅

| 目录/文件 | 说明 |
|----------|------|
| .claude/commands/opsx/ | 4个命令文档 |
| .claude/skills/ | 4个技能文档 |
| openspec/changes/restful-toolkit/ | 6个规范文档 |

---

## 四、已删除内容

### 删除的文档（8个）

1. ❌ docs/TEST_GUIDE.md（内容已包含在TESTING_GUIDE.md）
2. ❌ docs/VS_CODE_DEBUG_GUIDE.md（内容已包含在TESTING_GUIDE.md）
3. ❌ docs/TEST_REPORT.md（旧测试报告，已有新报告）
4. ❌ docs/FIX_WINDOW_ERROR.md（问题已修复）
5. ❌ docs/FINAL_CHECKLIST.md（项目已完成）
6. ❌ test-project/ACCEPTANCE-TEST-README.md（内容已包含在README.md）
7. ❌ RELEASE_v0.0.1.md（内容已包含在CHANGELOG.md）
8. ❌ docs/DOCUMENTATION_CLEANUP_PLAN.md（整理方案，已完成）

### 删除的测试脚本（3个）

1. ❌ test-manual.js（功能已包含在单元测试）
2. ❌ test-standalone.js（功能已包含在单元测试）
3. ❌ test-unit.js（功能已包含在单元测试）

### 删除的冗余目录结构（4项）

1. ❌ restful-tool（空目录）
2. ❌ restful-toolkit-0.0.1.vsix（打包文件应在.gitignore）
3. ❌ docs/demo/（与test-project重复）

### 重命名的文件

- screenshot_28fd660d-d8c6-455c-a0d3-20bc5bfc33e6 → screenshot.png

---

## 五、统计

### v0.0.8 当前状态

| 类别 | 数量 |
|------|------|
| 根目录文档 | 6个（README, README_CN, CHANGELOG, AGENTS, CLAUDE, LICENSE） |
| 国际化文件 | 2个（package.nls.json, package.nls.zh-cn.json） |
| docs 顶层文档 | 8 个（7 个 Markdown、1 个 screenshot） |
| 源代码模块 | 30个（含 extractor/ 9、commands/ 4、generator/ 2、utils/ 4） |
| 单元测试 | 272 个 Mocha 用例（含解析器集成、复制 URL/cURL 命令、FileScanner、ScanStateManager、EndpointCache、BaseUrlResolver、激活与 UI） |
| 自动化脚本 | 4个（50端点验证 + 78参数复制 + 115 URL/cURL + 86 JSON-to-DTO） |
| 测试 Controller | 3个（Spring 25 + JAX-RS 11 + Form） |
| 测试 DTO | 7个 |

### 历史整理记录

- **v0.0.2 整理**（2026-04-20）：删除8个冗余文档，清理3个冗余脚本，删除4项冗余目录
- **v0.0.3 更新**（2026-04-27）：新增国际化、参数复制功能、批量测试脚本、规范文档
- **v0.0.4 更新**（2026-04-29）：新增 Copy URL/cURL、Base URL 检测、请求头解析
- **v0.0.5 更新**（2026-05-19）：新增并发扫描、TextProcessor、JSON 转 DTO Lombok 选项、异步 I/O 与搜索排序优化
- **v0.0.6 更新**（2026-06-02）：优先修复代码审查 P0/P1 与中低优先级小问题，恢复编译与本地验证脚本稳定性
- **v0.0.7 更新**（2026-06-15）：FileScanner 去重重叠 glob 匹配，限制增量 stat 检查并发；SpringMvcParser 改为单次源码顺序扫描；EndpointCache 预计算搜索字段、维护 top-K 候选并隔离返回值变异；DtoFieldExtractor 缓存一次命令内 DTO 查找和直接字段解析；BaseUrlResolver 缓存 workspace 自动检测结果并按配置文件 mtime/ctime/size 变化失效；完成优化任务清单
- **v0.0.8 发布**（2026-08-12）：修复类型级路径、嵌套 Controller 所有权和重复 JAX-RS 注解行号；扫描结果与 `mtime + size` 状态仅在解析前后元数据稳定时原子提交；后台索引完成后刷新当前搜索；watcher 支持工作区相对排除模式；Base URL 删除同步文件系统入口并收窄配置 watcher；优化稳定 top-K 搜索与内存缓存

---

## 六、维护建议

### 文件命名规范
- ✅ 根目录文档：大写命名（CHANGELOG.md, README.md）
- ✅ 配置文件：小写命名（package.json, tsconfig.json）
- ✅ 源代码：驼峰命名（EndpointCache.ts）
- ✅ 测试文件：*.test.ts格式
- ✅ 截图文件：清晰命名（screenshot.png）

### 目录创建原则
- ✅ 不创建空目录
- ✅ 避免重复内容（test-project是唯一测试源）
- ✅ 临时文件不提交（.vsix应在.gitignore）

### 定期清理
- ✅ 每次版本发布后检查重复文档
- ✅ 合并相似内容
- ✅ 删除已完成临时文档和空目录

---

**文档与目录结构已优化完成 ✅**

**当前状态**: 最优结构，清晰规范，易于维护 🎯
