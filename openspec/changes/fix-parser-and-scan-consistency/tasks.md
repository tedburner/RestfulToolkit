## 1. 解析器回归测试

- [x] 1.1 添加方法级 Spring/JAX-RS 路径不得重复拼接的集成测试
- [x] 1.2 添加嵌套类端点所有权和绝对行号测试
- [x] 1.3 添加超过 500 字符及后续参数化注解的方法声明测试，并确认修复前失败

## 2. 解析器实现

- [x] 2.1 限定 Spring/JAX-RS 类级路径只能来自当前类型声明前的注解区域
- [x] 2.2 收集类范围并遮罩后代类，确保每个类只解析直接拥有的方法
- [x] 2.3 用结构扫描替代 Spring 方法名固定窗口和类级 RequestMapping 启发式窗口
- [x] 2.4 复用文件级行索引和绝对字符偏移，保持现有解析器契约测试通过

## 3. 增量扫描状态

- [x] 3.1 添加 watcher 成功重扫更新状态、删除清理状态及 mtime/size 差异测试，并确认修复前失败
- [x] 3.2 统一工作区与 watcher 的成功扫描记录路径，删除时同步清理记录
- [x] 3.3 以真实 mtime 与 size 判断增量变化，删除 deprecated/no-op/冗余扫描状态代码

## 4. Base URL 异步化

- [x] 4.1 将 BaseUrlResolver 单元测试和 URL/cURL 自动化脚本迁移到异步解析
- [x] 4.2 删除 ConfigManager/BaseUrlResolver 同步解析入口及同步文件系统实现
- [x] 4.3 将 Base URL 配置 watcher 收窄到 main/resources 并添加回归断言

## 5. 验证与文档

- [x] 5.1 运行 compile、lint、完整单元测试和三个自动化验证脚本
- [x] 5.2 使用 neat-freak 盘点并同步 AGENTS/CLAUDE、README、CHANGELOG、优化/测试文档和文档清单
- [x] 5.3 复核最终 diff、OpenSpec 状态和未实施项，确认搜索排序、内存模式与配置契约未改变
