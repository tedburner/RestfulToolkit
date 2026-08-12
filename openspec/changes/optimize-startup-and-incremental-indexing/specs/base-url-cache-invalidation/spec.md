## ADDED Requirements

### Requirement: Base URL 发现结果缓存在内存中
解析器必须（MUST）按标准化工作区路径缓存 Spring 配置发现与 Base URL 解析的最终结果，并且缓存只存在于当前 Extension Host 进程。

#### Scenario: 重复查询 Base URL
- **WHEN** 没有相关配置事件时重复请求同一工作区的 Base URL
- **THEN** 后续查询复用配置发现结果和解析值，不再遍历资源目录

#### Scenario: Extension Host 重启
- **WHEN** 新的 Extension Host 进程启动
- **THEN** 不从磁盘加载任何 Base URL 缓存数据

### Requirement: Spring 配置事件使所属工作区缓存失效
工作区内受支持的 `application*` 或 `bootstrap*` YAML/properties 文件被创建、修改或删除时，扩展必须（MUST）使该工作区的 Base URL 缓存失效。

#### Scenario: 现有配置发生变化
- **WHEN** 受监听的 Spring 配置文件发生变化
- **THEN** 下次 Base URL 查询重新发现并解析该工作区配置

#### Scenario: 创建 Profile 配置
- **WHEN** 创建新的受支持 Profile 配置文件
- **THEN** 在下次查询前使所属工作区缓存失效

#### Scenario: 其他工作区的配置发生变化
- **WHEN** 某个工作区文件夹中的相关文件发生变化
- **THEN** 其他工作区文件夹的 Base URL 缓存保持有效

#### Scenario: 异步解析期间配置发生变化
- **WHEN** Base URL 异步解析尚未完成时收到所属工作区的配置失效事件
- **THEN** 该异步解析结果不得回填缓存，下次查询必须重新发现并解析配置

### Requirement: 显式 reset 清除全部进程内 Base URL 数据
解析器 reset 和扩展停用必须（MUST）清除缓存的配置发现结果及 Base URL 解析值。

#### Scenario: 重置解析器缓存
- **WHEN** 执行显式缓存 reset
- **THEN** 每个工作区的下次查询都重新执行配置发现
