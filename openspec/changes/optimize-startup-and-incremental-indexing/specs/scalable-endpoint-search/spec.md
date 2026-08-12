## ADDED Requirements

### Requirement: 搜索仅保留有界候选
端点搜索遍历内存索引时，必须（MUST）保证保留的候选不超过已校验结果上限，并按照现有的路径、类名、方法名和总分顺序返回结果。

#### Scenario: 宽泛查询匹配数量超过上限
- **WHEN** 查询匹配的端点数量超过 `maxResults`
- **THEN** 只保留并返回排名最好的 `maxResults` 个端点

#### Scenario: 多个结果得分相同
- **WHEN** 多个匹配端点的排名分数相同
- **THEN** 它们在缓存中的相对插入顺序保持稳定

#### Scenario: 堆结果与参考排序比较
- **WHEN** 使用有界搜索和参考全量排序计算相同端点集合与查询
- **THEN** 两者在配置上限内生成完全相同的有序前缀

### Requirement: QuickPick 条目分配遵守结果上限
搜索界面必须（MUST）保证首次打开和每次查询后创建的端点条目均不超过已校验的 `maxResults`。

#### Scenario: 在大型缓存上打开搜索
- **WHEN** 缓存端点数量超过 `maxResults`
- **THEN** 初始 QuickPick 只包含前 `maxResults` 个端点条目

#### Scenario: 搜索条件发生变化
- **WHEN** 查询匹配数量超过 `maxResults`
- **THEN** 更新后的 QuickPick 条目不超过 `maxResults`

### Requirement: 大型缓存搜索具有回归守卫
测试套件必须（MUST）包含确定性大型缓存搜索检查，用于发现意外恢复“与结果上限线性相关的有序插入”，且不得依赖脆弱的耗时阈值。

#### Scenario: 搜索实现处理宽泛的大型缓存查询
- **WHEN** 测试使用较大结果上限搜索合成端点集合
- **THEN** 候选维护操作符合对数级堆行为，而不是在保留列表中线性插入
