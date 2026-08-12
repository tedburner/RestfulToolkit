# RestfulToolkit 项目长期笔记

## 项目性质
VS Code 扩展，搜索/导航 Java/Kotlin Spring + JAX-RS RESTful 端点。OpenSpec 规范驱动开发。

## 关键架构决策
- 扫描层 FileScanner：多 glob 合并 + 去重 + 并发扫描（scanConcurrency=15）+ scanPromise 串行队列
- 缓存层 EndpointCache：双索引（by path + by file）+ 预计算 lowercase/camelCase/acronym + 稳定有界堆 top-K
- 增量扫描：基于 mtime 比较，内存模式（ScanStateManager 不持久化，每次启动全量）
- BaseUrl 解析：按 workspaceFolder 缓存 + generation/cacheEpoch 双重失效令牌防异步回填
- DTO 提取：三层缓存（dtoFileCache/sanitizedContentCache/directFieldsCache）+ maxDepth=3 + visited Set 防循环

## 已知优化点（2026-07-29 review，8 项 + 1 项撤销）
详细文档：docs/CODE_REVIEW_2026-07-29.md
1. **[高·性能]** EndpointCache.removeByFile 全数组 filter 重建 → 大仓库频繁保存热点
2. **[高·正确性]** ScanStateManager mtime 精度风险 → 秒级 FS 上 1 秒内连存误判，建议 size+hash 降级
3. **[中·边界]** SpringMvcParser findMethodNameForward 500/1000 字符硬编码窗口（6-01 L-15 延续）
4. **[中·资源]** extension.ts baseUrlConfigWatcher 无 exclude，监视 node_modules
5. **[中·性能]** AnnotationParser 每个类块重复 buildLineIndex，可复用文件级索引+偏移
6. **[低·维护]** BaseUrlResolver resolve() 同步版本疑似死代码（6-01 M-7 延续，SIM-001 已合并核心路径）
7. **[低·维护]** ScanStateManager 死代码（setContext/loadState/fileHash）
8. **[低·可配]** scanConcurrency=15 / progressThrottleMs=200 硬编码

**已撤销**：DTO 三层缓存「永不失效」误判——OPT-003 是 Command-Lifecycle Cache，DtoFieldExtractor 随命令实例销毁释放，非 bug

## 已合理实现的优化（保留）
注解预筛、双索引、状态栏节流、防抖、增量扫描、双重失效令牌、二分行号、命令先注册再扫描
