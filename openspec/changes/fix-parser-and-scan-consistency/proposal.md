## Why

当前端点解析在方法级 `@RequestMapping`、嵌套类和超长方法声明等边界上会产生路径重复、端点归属错误或静默漏检；同时，文件监听更新端点缓存后未同步内存扫描状态，导致增量刷新统计漂移和重复扫描。Base URL 仍保留未被生产入口使用的同步 I/O 路径，配置监听范围也宽于解析器实际读取范围。

## What Changes

- 仅将紧邻类声明的 Spring `@RequestMapping` 和 JAX-RS `@Path` 识别为类级路径，方法级路径不再被重复拼接。
- 按类声明的真实所有权解析嵌套类，避免外层类与内层类相互重复收集端点。
- 用结构化声明边界替代 Spring 方法名查找的固定字符窗口，同时复用文件级行索引并保持行号准确。
- 文件创建、修改和删除后同步更新内存扫描记录；增量判断记录真实文件 `mtime` 与 `size`，不引入持久化或全文件 hash。
- 删除无生产调用者的同步 Base URL 解析链及相应同步测试入口，统一使用 VS Code 异步文件系统 API。
- 将 Base URL 配置 watcher 收窄到 Resolver 实际支持的 `main/resources` 范围，不增加错误的 exclude 参数或新用户配置。
- 删除内存扫描状态中的 deprecated/no-op/冗余字段和方法。

## Capabilities

### New Capabilities

- `endpoint-declaration-parsing`: 定义类级路径归属、嵌套类隔离、长方法声明识别和行号准确性要求。
- `incremental-scan-consistency`: 定义文件监听与内存扫描记录的一致性、增量变更判定和删除行为。
- `base-url-async-resolution`: 定义仅异步解析 Base URL 及配置监听范围。

### Modified Capabilities

无。当前仓库尚无既有 capability specs。

## Impact

- 解析器：`AnnotationParser`、`SpringMvcParser`、`JaxRsParser` 及其测试。
- 扫描与状态：`FileScanner`、`ScanStateManager`、扩展文件监听调用链及其测试。
- Base URL：`ConfigManager`、`BaseUrlResolver`、`extension.ts`、单元测试和自动化脚本。
- 文档：AGENTS/CLAUDE、README、CHANGELOG、优化与测试文档、文档清单。
- 不新增依赖，不改变配置格式，不写入本地缓存，不改变搜索匹配与排序契约。
