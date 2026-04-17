# File Scanning Specification

## ADDED Requirements

### Requirement: 扫描 Java 和 Kotlin 文件

系统 SHALL 扫描工作区中的 Java 和 Kotlin 源文件。

#### Scenario: 扫描 Java 文件
- **WHEN** 扩展激活时
- **THEN** 系统扫描所有 `src/main/java/**/*.java` 文件,提取 RESTful 端点信息

#### Scenario: 扫描 Kotlin 文件
- **WHEN** 扩展激活时
- **THEN** 系统扫描所有 `src/main/kotlin/**/*.kt` 文件,提取 RESTful 端点信息

#### Scenario: 扫描范围可配置
- **WHEN** 用户在扩展设置中配置扫描路径
- **THEN** 系统按用户配置的路径模式扫描文件,而不是使用默认路径

#### Scenario: 排除测试文件
- **WHEN** 扫描工作区文件时
- **THEN** 系统默认排除 `src/test/java` 和 `src/test/kotlin` 目录中的文件

### Requirement: 异步执行初始扫描

系统 SHALL 异步执行初始文件扫描,不阻塞 VS Code UI。

#### Scenario: 扩展激活时启动异步扫描
- **WHEN** 扩展激活时
- **THEN** 系统在后台启动文件扫描进程,VS Code UI 保持响应

#### Scenario: 显示扫描进度提示
- **WHEN** 文件扫描正在进行
- **THEN** 系统在状态栏显示进度提示 "RestfulToolkit: 正在扫描项目... (已扫描 X/Y 文件)"

#### Scenario: 扫描完成后通知用户
- **WHEN** 文件扫描完成
- **THEN** 系统在状态栏显示 "RestfulToolkit: 扫描完成,共找到 X 个 REST 端点" (持续 3 秒后消失)

### Requirement: 监听文件创建事件

系统 SHALL 监听工作区中的文件创建事件。

#### Scenario: 创建新的 Java 文件
- **WHEN** 用户在工作区中创建新的 Java 文件
- **THEN** 系统扫描该文件,提取 RESTful 端点并添加到缓存

#### Scenario: 创建新的 Kotlin 文件
- **WHEN** 用户在工作区中创建新的 Kotlin 文件
- **THEN** 系统扫描该文件,提取 RESTful 端点并添加到缓存

#### Scenario: 创建非 Java/Kotlin 文件
- **WHEN** 用户创建非 Java/Kotlin 文件(如 .txt, .xml)
- **THEN** 系统忽略该文件创建事件,不触发扫描

### Requirement: 监听文件修改事件

系统 SHALL 监听工作区中的文件修改事件。

#### Scenario: 修改现有 Java 文件
- **WHEN** 用户修改工作区中的 Java 文件并保存
- **THEN** 系统重新扫描该文件,更新缓存中的端点信息:
  - 移除该文件的旧端点记录
  - 添加该文件的新端点记录

#### Scenario: 修改现有 Kotlin 文件
- **WHEN** 用户修改工作区中的 Kotlin 文件并保存
- **THEN** 系统重新扫描该文件,更新缓存中的端点信息

#### Scenario: 修改文件但未保存
- **WHEN** 用户修改文件内容但未保存
- **THEN** 系统不触发重新扫描,缓存仍基于已保存的版本

#### Scenario: 修改文件但无端点变化
- **WHEN** 用户修改文件内容但 RESTful 端点未变化(如修改注释、非 Controller 方法)
- **THEN** 系统仍然重新扫描该文件,但缓存内容不变

### Requirement: 监听文件删除事件

系统 SHALL 监听工作区中的文件删除事件。

#### Scenario: 删除 Java 文件
- **WHEN** 用户删除工作区中的 Java 文件
- **THEN** 系统从缓存中移除该文件的所有端点记录

#### Scenario: 删除 Kotlin 文件
- **WHEN** 用户删除工作区中的 Kotlin 文件
- **THEN** 系统从缓存中移除该文件的所有端点记录

#### Scenario: 删除非 Java/Kotlin 文件
- **WHEN** 用户删除非 Java/Kotlin 文件
- **THEN** 系统忽略该删除事件

### Requirement: 扫描性能优化

系统 SHALL 优化扫描性能以处理大型项目。

#### Scenario: 大型项目扫描时间控制
- **WHEN** 扫描包含 1000+ Java/Kotlin 文件的大型项目
- **THEN** 系统初始扫描时间控制在 10 秒以内(性能目标)

#### Scenario: 避免重复扫描同一文件
- **WHEN** 同一文件在短时间内被多次修改和保存
- **THEN** 系统只重新扫描一次,避免不必要的重复处理

#### Scenario: 并行扫描多个文件
- **WHEN** 执行初始扫描时
- **THEN** 系统并行扫描多个文件,提高扫描速度

### Requirement: 处理扫描错误

系统 SHALL 正确处理扫描过程中的错误。

#### Scenario: 文件读取失败
- **WHEN** 扫描过程中某个文件读取失败(权限问题、文件锁定等)
- **THEN** 系统跳过该文件,继续扫描其他文件,记录错误日志

#### Scenario: 文件内容解析失败
- **WHEN** 扫描某个文件时无法解析注解(文件格式异常、编码问题)
- **THEN** 系统跳过该文件,记录警告日志,不阻塞整体扫描

#### Scenario: 扫描过程被中断
- **WHEN** 扫描过程中 VS Code 关闭或扩展被禁用
- **THEN** 系统停止扫描,保存已完成的结果到缓存

### Requirement: 支持多工作区

系统 SHALL 支持 VS Code 多工作区功能。

#### Scenario: 多工作区独立扫描
- **WHEN** VS Code 打开多个工作区文件夹
- **THEN** 系统分别扫描每个工作区的 Java/Kotlin 文件,维护各自的端点缓存

#### Scenario: 切换工作区时更新缓存
- **WHEN** 用户在多工作区环境中切换活动工作区
- **THEN** 系统加载该工作区的端点缓存

#### Scenario: 工作区文件夹被移除
- **WHEN** 用户从多工作区中移除某个文件夹
- **THEN** 系统清除该工作区的端点缓存

### Requirement: 提供手动刷新功能

系统 SHALL 提供手动触发重新扫描的命令。

#### Scenario: 用户手动触发全量扫描
- **WHEN** 用户执行命令 "RestfulToolkit: Refresh Endpoints"
- **THEN** 系统清空缓存,重新扫描所有 Java/Kotlin 文件

#### Scenario: 扫描过程中用户触发刷新
- **WHEN** 初始扫描正在进行时用户触发手动刷新
- **THEN** 系统停止当前扫描,重新开始全量扫描

### Requirement: 扫描结果缓存持久化(可选)

系统 MAY 支持扫描结果缓存持久化(后续版本考虑)。

#### Scenario: 扩展重启后快速加载
- **WHEN** 扩展重新激活(VS Code 重启)
- **THEN** 系统优先从持久化缓存文件加载端点数据,快速提供搜索功能

#### Scenario: 检测缓存是否过期
- **WHEN** 扩展从持久化缓存加载数据
- **THEN** 系统检测缓存时间戳,如果缓存过期(超过一定时间),触发重新扫描

#### Scenario: 缓存文件损坏
- **WHEN** 持久化缓存文件损坏或格式错误
- **THEN** 系统删除损坏的缓存,执行全量扫描