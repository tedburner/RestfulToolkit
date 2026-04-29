# RestfulToolkit 文档与目录清单

## 整理完成 ✅

**整理日期**: 2026-04-20 | **更新日期**: 2026-04-29（v0.0.4 Copy URL/cURL 功能）

**v0.0.4 新增**:
- `src/extractor/UrlGenerator.ts` — 完整 URL 生成
- `src/extractor/CurlConverter.ts` — cURL 命令生成
- `src/commands/CopyUrlCommand.ts` — 复制完整 URL 命令
- `src/commands/CopyCurlCommand.ts` — 复制 cURL 命令
- `src/utils/BaseUrlResolver.ts` — Base URL 自动检测
- `src/test/extractor/UrlGenerator.test.ts` — URL 生成测试（5 用例）
- `src/test/extractor/CurlConverter.test.ts` — cURL 生成测试（5 用例）
- `src/test/utils/BaseUrlResolver.test.ts` — Base URL 检测测试（5 用例）
- `package.nls.json` / `package.nls.zh-cn.json` — 新增 copyUrl/copyCurl 命令标题

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
├── src/ (源代码14个模块)
│   ├── extension.ts         # 扩展入口
│   ├── cache/               # 缓存管理（2模块）
│   ├── commands/            # 命令（3模块：CopyEndpointParameters, CopyUrl, CopyCurl）
│   ├── config/              # 配置管理（2模块）
│   ├── extractor/           # 参数提取（8模块：FormatConverter, ParameterExtractor, SpringParameterParser, JaxRsParameterParser, DtoFieldExtractor, i18n, UrlGenerator, CurlConverter）
│   ├── models/              # 数据模型（1模块）
│   ├── parsers/             # 注解解析（3模块）
│   ├── scanner/             # 文件扫描（1模块）
│   ├── ui/                  # 用户界面（1模块）
│   ├── utils/               # 工具类（3模块：FileWatcher, Logger, BaseUrlResolver）
│   └── test/                # 单元测试（含 UrlGenerator, CurlConverter, BaseUrlResolver 测试）
│
├── docs/ (文档6个)
│   ├── CONFIG_SYSTEM.md     # 配置系统文档
│   ├── DOCUMENTATION_MANIFEST.md # 本清单
│   ├── INCREMENTAL_SCAN.md  # 增量扫描文档
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
│   ├── scripts/             # 测试脚本
│   │   ├── test-all-files.js     # 端点验证脚本（49端点）
│   │   └── test-parameter-copy.js # 参数复制批量测试（75测试）
│   └── src/main/            # 测试Controller + DTO
│       └── java/com/example/
│           ├── controller/  # TestController, TestResource, FormController
│           └── dto/         # UserDto, OrderDto, AddressDto, SnakeCaseDto, AliasDto, LoginForm
│
├── openspec/ (OpenSpec规范 - 保持不变)
│   └── changes/restful-toolkit/
│
└── .claude/ (Claude配置 - 保持不变)
```

**评价**: ✅ 结构清晰，职责分明，无冗余，符合VS Code扩展标准

---

## 二、测试脚本结构

### 单元测试（Mocha框架）- 9个文件 ✅

**位置**: `src/test/` 目录

| 文件 | 说明 |
|------|------|
| runTest.ts | Mocha测试入口 |
| parsers/SpringMvcParser.test.ts | Spring解析器测试（含 @RequestHeader） |
| parsers/JaxRsParser.test.ts | JAX-RS解析器测试（含 @HeaderParam） |
| cache/EndpointCache.test.ts | 缓存测试 |
| extractor/UrlGenerator.test.ts | URL 生成测试（5 用例） |
| extractor/CurlConverter.test.ts | cURL 生成测试（5 用例） |
| extractor/NameTransformer.test.ts | 命名转换测试 |
| extractor/FormatConverter.test.ts | 格式转换测试 |
| extractor/SpringParameterParser.test.ts | Spring 参数解析测试 |
| extractor/JaxRsParameterParser.test.ts | JAX-RS 参数解析测试 |
| utils/BaseUrlResolver.test.ts | Base URL 自动检测测试（5 用例） |

**运行**: `npm test`

### 自动化验证 - 2个脚本 ✅

**位置**: `src/test/scripts/`

| 脚本 | 说明 | 运行 |
|------|------|------|
| test-all-files.js | 49个端点验证、行号准确性100%、多路径拆分、Kotlin支持 | `node src/test/scripts/test-all-files.js` |
| test-parameter-copy.js | 75个参数复制测试（Spring/JAX-RS解析、DTO提取、格式转换、文件完整性） | `node src/test/scripts/test-parameter-copy.js` |
| test-copy-url-curl.js | 107个测试（URL生成、cURL转换、Base URL解析、Header端到端） | `node src/test/scripts/test-copy-url-curl.js` |

---

## 三、文档清单

### 根目录文档 (4个) ✅

| 文档 | 说明 |
|------|------|
| README.md | 项目主文档（英文）|
| README_CN.md | 项目主文档（中文）|
| CHANGELOG.md | 版本变更日志 |
| CLAUDE.md | Claude开发指导 |

### docs目录 (7个) ✅

| 文档 | 说明 |
|------|------|
| TESTING_GUIDE.md | VS Code测试指南 |
| CONFIG_SYSTEM.md | 配置系统文档 |
| INCREMENTAL_SCAN.md | 增量扫描文档 |
| DOCUMENTATION_MANIFEST.md | 本清单文档 |
| screenshot.png | 扩展截图演示 |
| superpowers/plans/2026-04-27-endpoint-parameter-copy.md | 参数复制功能实现计划 |
| superpowers/specs/2026-04-27-endpoint-parameter-copy-design.md | 参数复制功能设计规格 |

### test-project目录 (2个 + 脚本 + 测试代码) ✅

| 文档 | 说明 |
|------|------|
| README.md | 测试项目说明 |
| TEST-COVERAGE-CHECKLIST.md | 测试覆盖清单 |
| scripts/test-parameter-copy.js | 参数复制批量测试（75个） |

**测试 Controller**（3个）：TestController（Spring 26端点）、TestResource（JAX-RS 9端点）、FormController（@ModelAttribute）
**测试 DTO**（6个）：UserDto, OrderDto, AddressDto, SnakeCaseDto, AliasDto, LoginForm

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
4. ❌ src/test/scanner/（空目录）

### 重命名的文件

- screenshot_28fd660d-d8c6-455c-a0d3-20bc5bfc33e6 → screenshot.png

---

## 五、统计

### v0.0.4 当前状态

| 类别 | 数量 |
|------|------|
| 根目录文档 | 6个（README, README_CN, CHANGELOG, CLAUDE, LICENSE, RELEASE_v0.0.2） |
| 国际化文件 | 2个（package.nls.json, package.nls.zh-cn.json） |
| docs 文档 | 5个（CONFIG_SYSTEM, DOCUMENTATION_MANIFEST, INCREMENTAL_SCAN, TESTING_GUIDE, screenshot.png） |
| 源代码模块 | 19个（含 extractor/ 8、commands/ 3、utils/ 3） |
| 单元测试 | 9+ Mocha 测试 |
| 自动化脚本 | 2个（49端点验证 + 75参数复制测试） |
| 测试 Controller | 3个（Spring 26 + JAX-RS 9 + Form） |
| 测试 DTO | 6个 |

### 历史整理记录

- **v0.0.2 整理**（2026-04-20）：删除8个冗余文档，清理3个冗余脚本，删除4项冗余目录
- **v0.0.3 更新**（2026-04-27）：新增国际化、参数复制功能、批量测试脚本、规范文档
- **v0.0.4 更新**（2026-04-29）：新增 Copy URL/cURL、Base URL 检测、请求头解析

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