## Context

### 背景

当前 VS Code 生态中，Java/Spring 项目缺少一个高效的 RESTful API 端点搜索工具。开发人员在定位特定的 REST 接口实现时，需要：
1. 手动浏览多个 Controller 类文件
2. 使用文本搜索功能查找关键词
3. 在类和方法之间反复切换

这种工作流程效率低下，特别是在拥有数百个端点的大型项目中。

### 技术限制

VS Code 扩展开发环境的关键约束：
- **语言限制**：VS Code 扩展必须使用 TypeScript/JavaScript 开发
- **编译器访问限制**：无法直接使用 Java 编译器（如 Eclipse JDT）进行完整的语义分析
- **Language Server Protocol 限制**：LSP 标准协议不提供获取注解参数值的能力
- **Spring Boot Tools 限制**：现有的 Spring Boot Tools 扩展仅提供运行时数据（通过 Actuator），不支持静态代码扫描

### 相关工具现状

- **IntelliJ IDEA**：有完整的 Java 分析引擎，提供类似功能但仅在 IntelliJ 平台可用
- **VS Code Java Extension (Red Hat)**：提供语法支持，但无 REST 端点搜索功能
- **Spring Boot Tools**：仅支持运行时数据，依赖应用启动

## Goals / Non-Goals

**Goals:**

1. **实现静态代码扫描**：无需应用运行即可扫描项目源代码
2. **支持主流框架**：支持 Spring MVC (Spring Boot) 和 JAX-RS 注解
3. **支持多语言**：支持 Java 和 Kotlin 源文件
4. **提供快速搜索**：实现模糊匹配的快速搜索界面
5. **实现准确跳转**：精确定位到 Controller 方法定义位置
6. **保持响应性能**：大型项目（数千文件）扫描时间控制在合理范围
7. **实时更新**：监听文件变更，自动更新缓存

**Non-Goals:**

1. **不支持运行时数据**：不依赖应用运行状态，不集成 Spring Boot Actuator 数据
2. **不支持复杂场景的完美覆盖**：第一版明确接受 15-20% 的遗漏率
   - 继承关系中的父类注解
   - 配置类动态生成的路径
   - 属性文件引用的路径（`${}` 变量）
3. **不支持其他 JVM 语言**：仅支持 Java 和 Kotlin，不支持 Groovy、Scala 等
4. **不支持其他框架**：第一版仅支持 Spring 和 JAX-RS，不支持 Micronaut、Quarkus 等
5. **不提供 HTTP 测试工具**：不实现 Postman 类似的请求测试功能（后续版本考虑）

## Decisions

### Decision 1: 技术栈选择

**决策**：使用 TypeScript + VS Code 内置 API + 正则表达式解析

**理由**：
- TypeScript 是 VS Code 扩展的唯一官方支持语言
- VS Code Workspace API 提供文件读取、监听、搜索等核心功能
- 正则表达式能处理 80-85% 的常规注解场景

**替代方案**：
- ❌ 方案 A（纯 Language Server）：LSP 不提供注解值获取，无法实现核心功能
- ❌ 方案 C（Java AST 解析器）：TypeScript 生态无成熟 Java 解析器，实现难度极高
- ✅ 方案 B（混合方案）：利用 VS Code API + 自己解析注解值，平衡可行性与准确度

### Decision 2: 文件扫描策略

**决策**：启动时全量扫描 + 监听文件变更增量更新

**理由**：
- 全量扫描确保启动后即可使用
- 增量更新避免每次搜索重新扫描，提升响应速度
- 监听变更保证数据实时性

**扫描范围**：
- 默认路径：`src/main/java/**/*.java`, `src/main/kotlin/**/*.kt`
- 可配置：用户可自定义扫描路径（通过扩展设置）
- 性能优化：大型项目可选择只扫描特定模块

**扫描时机**：
- 扩展激活时：执行全量扫描（异步执行，不阻塞 UI）
- 文件创建：增量添加新文件中的端点
- 文件修改：重新解析该文件，更新缓存
- 文件删除：移除该文件的所有端点记录

### Decision 3: 注解解析方式

**决策**：正则表达式匹配 + 简单的类级别路径组合

**实现细节**：

**Spring MVC 注解**：
```typescript
// 类级别路径
@RequestMapping("/api")
// 正则: @RequestMapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"\s*\)

// 方法级别
@GetMapping("/users")
@PostMapping(value = "/create")
@RequestMapping(path = "/list", method = RequestMethod.GET)
// 正则: @(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"\s*\)
```

**JAX-RS 注解**：
```typescript
// 类级别
@Path("/api")

// 方法级别
@GET
@Path("/users")
// 需要组合：/api/users
```

**路径组合逻辑**：
1. 扫描类级别注解，提取类路径前缀
2. 扫描方法级别注解，提取方法路径
3. 组合：类路径 + 方法路径 = 完整路径
4. 多路径处理：`@RequestMapping(value = {"/users", "/list"})` 拆分为多个端点

**Kotlin 注解处理**：
- Kotlin 注解语法与 Java 基本相同
- 需处理 Kotlin 特有语法：字符串模板 `${basePath}/users`（第一版可能不支持）
- 需处理 Kotlin 简化语法：`@GetMapping("/users")` 或 `@GetMapping"/users"`（省略括号）

### Decision 4: 数据结构设计

**决策**：使用扁平化的端点数据结构

**数据模型**：
```typescript
interface RestEndpoint {
  method: string;           // HTTP 方法: GET, POST, PUT, DELETE, PATCH
  path: string;             // 完整路径: /api/users
  className: string;        // 类名: UserController
  methodName: string;       // 方法名: listUsers
  file: string;             // 文件路径: src/main/java/com/example/UserController.java
  line: number;             // 行号: 25
  framework: 'Spring' | 'JAX-RS';  // 框架类型
}
```

**缓存结构**：
```typescript
class EndpointCache {
  private endpoints: Map<string, RestEndpoint[]>;  // 路径 -> 端点列表
  private fileIndex: Map<string, RestEndpoint[]>;  // 文件 -> 端点列表

  // 查询方法
  search(query: string): RestEndpoint[];
  getByFile(file: string): RestEndpoint[];
  add(endpoint: RestEndpoint): void;
  removeByFile(file: string): void;
  updateFile(file: string, endpoints: RestEndpoint[]): void;
}
```

### Decision 5: 搜索匹配算法

**决策**：多字段模糊匹配 + 权重评分排序

**匹配策略**：
- **路径匹配**：权重 0.4 - 最重要
  - `/api/users` 查询匹配 `/api/users`, `/api/user`, `/api/user-management`
  - 支持路径片段匹配：`users` 匹配 `/api/users`

- **类名匹配**：权重 0.3
  - `UserController` 查询匹配 `UserController`, `UserCtrl`
  - 驼峰命名模糊匹配：`UserC` 匹配 `UserController`

- **方法名匹配**：权重 0.2
  - `listUsers` 查询匹配 `listUsers`, `listUser`

- **HTTP 方法匹配**：权重 0.1
  - `GET` 匹配所有 GET 方法端点

**评分机制**：
```typescript
interface MatchScore {
  pathScore: number;      // 路径匹配分数
  classScore: number;     // 类名匹配分数
  methodScore: number;    // 方法名匹配分数
  httpScore: number;      // HTTP 方法匹配分数
  total: number;          // 总分 = weighted sum
}
```

**搜索流程**：
1. 用户输入查询字符串
2. 对缓存中所有端点计算匹配分数
3. 过滤分数 > 0 的结果
4. 按总分降序排列
5. 返回前 N 个结果（限制显示数量）

### Decision 6: QuickPick UI 设计

**决策**：VS Code QuickPick API + 自定义显示格式

**显示格式**：
```
Label:       [GET] /api/users - UserController.listUsers()
Description: src/main/java/com/example/UserController.java
Detail:      Spring MVC
```

**图标设计**：
- GET: 绿色图标
- POST: 蓝色图标
- PUT: 黄色图标
- DELETE: 红色图标
- PATCH: 紫色图标

**交互流程**：
1. 用户触发快捷键（Ctrl\ 或 Ctrl+Alt+N）
2. 打开 QuickPick 弹窗
3. 显示所有端点列表（或根据查询过滤）
4. 用户输入搜索查询
5. 实时更新结果列表
6. 用户选择端点
7. 打开对应文件，跳转到方法行号

### Decision 7: 错误处理策略

**决策**：静默处理解析错误，记录日志用于调试

**处理策略**：
- **解析失败**：跳过该文件，不阻塞整体扫描
- **路径格式异常**：记录警告日志，跳过该端点
- **文件读取失败**：跳过该文件，监听后续变更
- **跳转失败**：显示错误提示，但不崩溃

**日志级别**：
- INFO: 扫描进度、文件变更事件
- WARNING: 解析失败的注解、路径格式异常
- ERROR: 文件读取失败、跳转失败

**用户提示**：
- 仅在严重错误时显示通知
- 解析错误不显示，避免干扰用户
- 提供"查看日志"命令，供用户调试

## Risks / Trade-offs

### Risk 1: 准确度限制（15-20% 遗漏率）

**风险描述**：
无法处理的复杂场景：
- 继承关系：父类上的注解无法识别
- 配置类动态路径：通过 `@Configuration` 生成路由
- 属性文件引用：`@RequestMapping("${api.path}")` 无法解析
- 条件注解：`@ConditionalOnProperty` 影响路径是否生效

**缓解措施**：
1. **文档明确说明**：README 中列出限制场景
2. **后续版本改进**：
   - 尝试利用 Language Server 类型信息处理继承
   - 研究配置类扫描策略
   - 集成 Spring Boot Tools 运行时数据（可选）
3. **用户反馈渠道**：收集遗漏案例，优先改进高频场景

### Risk 2: 大型项目性能问题

**风险描述**：
数千文件的初始扫描可能耗时较长（预计 5-10 秒），影响用户体验。

**缓解措施**：
1. **异步扫描**：不阻塞 UI，显示进度提示
2. **扫描范围限制**：默认只扫描 `src/main/java` 和 `src/main/kotlin`
3. **可配置路径**：用户可缩小扫描范围到特定模块
4. **增量更新**：文件变更只重新解析单个文件
5. **缓存持久化**：考虑缓存到文件，重启后快速加载（后续版本）

### Risk 3: Kotlin 语法特殊性

**风险描述**：
Kotlin 注解语法与 Java 有细微差异，可能导致解析失败：
- 字符串模板：`"${basePath}/users"`
- 简化语法：省略括号 `@GetMapping"/users"`
- 多行注解：注解参数跨多行

**缓解措施**：
1. **第一版明确限制**：文档说明 Kotlin 支持可能不完整
2. **专门测试**：收集 Kotlin 注解实际案例，补充正则规则
3. **社区反馈**：发布后收集 Kotlin 项目用户的 bug 报告

### Risk 4: 正则表达式复杂性

**风险描述**：
Spring/JAX-RS 注解格式多样，正则规则复杂：
- `@RequestMapping(value = "/api")`
- `@RequestMapping(path = "/api", method = RequestMethod.GET)`
- `@RequestMapping(value = {"/users", "/list"})`
- 注解参数顺序不固定

**缓解措施**：
1. **多种正则规则**：针对不同格式编写多个正则
2. **测试套件**：建立注解格式测试集，验证覆盖率
3. **逐步完善**：第一版覆盖常见格式，后续补充罕见格式

### Trade-off 1: 准确度 vs 实现难度

**权衡**：
接受 15-20% 遗漏率，换取实现可行性和开发速度。

**理由**：
- 完美准确度需要 Java 编译器，在 TypeScript 环境中无法实现
- 80-85% 准确度已能大幅提升开发效率
- 后续版本可持续改进

### Trade-off 2: 功能完整性 vs MVP 速度

**权衡**：
第一版仅实现搜索+跳转核心功能，暂不实现辅助功能。

**理由**：
- 快速发布，验证核心价值
- 收集用户反馈，优先改进高频需求
- Services Tree、HTTP 测试工具等后续版本实现

## Migration Plan

不适用（新项目，无迁移需求）

## Open Questions

1. **缓存持久化**：是否需要在第一版实现缓存持久化到文件？
   - 优点：重启后快速加载，提升体验
   - 缺点：增加复杂度，需要处理缓存失效
   - **建议**：第一版不实现，收集用户反馈后再决定

2. **多工作区支持**：VS Code 支持多工作区，如何处理？
   - 每个工作区独立缓存？
   - 跨工作区搜索？
   - **建议**：第一版支持单工作区，后续版本支持多工作区

3. **Maven/Gradle 多模块项目**：如何优化大型多模块项目扫描？
   - 是否需要识别模块结构？
   - 是否按模块优先级扫描？
   - **建议**：第一版扁平扫描所有文件，后续版本考虑模块结构

4. **注解参数顺序**：如何处理注解参数顺序不固定？
   - `@RequestMapping(path = "/api", method = GET)`
   - `@RequestMapping(method = GET, path = "/api")`
   - **建议**：正则同时匹配两种顺序，或拆分为多个正则规则

5. **Kotlin 字符串模板**：是否在第一版支持 `${basePath}` 语法？
   - 需要额外解析逻辑
   - 可能需要读取配置文件
   - **建议**：第一版不支持，文档说明限制，后续版本改进