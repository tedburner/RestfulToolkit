# 功能测试指南

## 测试准备

✅ 代码已编译
✅ 插件已打包
✅ 新增测试用例已添加（6个新Controller）

## 测试步骤

### 1. 启动测试项目

**方法A：在当前VS Code中测试**
- 当前项目已经包含 `test-project/` 目录
- 直接在当前 VS Code 窗口测试即可

**方法B：打开独立测试项目**
- File → Open Folder → 选择 `F:\Project\person\restful-toolkit\test-project`
- 在新窗口测试

### 2. 触发插件扫描

插件应该自动激活，如果没有：

1. 按 `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`)
2. 输入 "Reload Window"
3. 等待插件加载

查看扫描进度：
- 左下角状态栏显示 "RestfulToolkit: 正在扫描项目..."
- 完成后显示 "扫描完成，共找到 X 个 REST 端点"

### 3. 测试搜索和定位功能

#### 测试 3.1：多路径注解定位（核心测试）

**目标**：验证之前报告的定位问题是否修复

**步骤**：
1. 按 `Ctrl+\` 或 `Ctrl+Alt+N` (Mac: `Cmd+\` 或 `Cmd+Alt+N`)
2. 搜索框输入：`active`
3. 应该看到两个结果：
   - `🟢 [GET] /api/users/active - UserController.getActiveUsers()`
   - `🟢 [GET] /api/users/enabled - UserController.getActiveUsers()`
4. 选择第一个结果（`/api/users/active`）
5. **预期结果**：
   - 打开 `UserController.java`
   - **跳转到第34行**：`@GetMapping({"/active", "/enabled"})`
   - 光标应该在这行开始位置
6. 关闭文件
7. 选择第二个结果（`/api/users/enabled`）
8. **预期结果**：
   - 同样跳转到第34行（两个端点都定位到同一行）

**问题验证**：
- ❌ 之前的问题：跳转到第30行 `@DeleteMapping("/{id}")`
- ✅ 现在应该：正确跳转到第34行

#### 测试 3.2：新增测试用例验证

搜索以下关键词验证新测试文件：

**CategoryController.java**:
1. 搜索 `test/` 或 `test/`
   - 应该找到：`🟢 [GET] /api/categories/test/ - CategoryController.testEndpoint()`
   - 定位到第17行

2. 搜索 `{id}` 或 `category`
   - 验证路径变量和嵌套路径

**ApiV2Controller.java**:
1. 搜索正则路径：
   - `\d+` → 应该找到 `/api/v2/products/{id:\d+}`
   - `[A-Z]` → 应该找到 `/api/v2/products/{code:[A-Z]{3}\d{4}}`

2. 搜索嵌套路径：
   - `userId` + `orderId` → 应该找到 `/api/v2/users/{userId}/orders/{orderId}`

**ItemController.java**:
1. 搜索 `items` 或 `alt`
   - 应该找到两个路径的端点：`/api/items` 和 `/api/products/alt`

**HealthController.java**:
1. 搜索 `health` 或 `ping`
   - 验证无类级别路径的方法级别完整路径

**NestedPathController.java**:
1. 搜索三层嵌套：
   - `companies` → `/api/v1/companies/{companyId}/departments/{deptId}/employees/{empId}`

### 4. 测试增量扫描功能

#### 测试 4.1：首次扫描验证

1. 打开 VS Code Output 面板（View → Output）
2. 选择 "RestfulToolkit" 输出频道
3. 查看日志：
   - 应该显示：`Scan strategy: FULL (no history)` 或 `INCREMENTAL (use history)`
   - 显示扫描文件数和端点数

#### 测试 4.2：增量刷新

1. `Ctrl+Shift+P` → 输入 "Refresh Endpoints"
2. 选择刷新模式：
   - **增量刷新**（推荐）：仅扫描修改文件
   - **全量刷新**：重新扫描所有文件
3. 选择"增量刷新"
4. 查看状态栏和日志：
   - 应显示：`扫描完成（增量模式），扫描 X 文件，跳过 Y 未修改文件`
   - 日志显示：`Skipped (unchanged): ...`

#### 测试 4.3：文件修改触发更新

1. 打开 `UserController.java`
2. 在第34行附近添加新端点：
   ```java
   @GetMapping("/new-test")
   public String newTestEndpoint() {
       return "新测试端点";
   }
   ```
3. 保存文件（Ctrl+S）
4. 等待几秒（文件监听器触发）
5. 按 `Ctrl+\` 搜索 `new-test`
6. **预期结果**：能找到新端点 `/api/users/new-test`

#### 测试 4.4：重启项目验证

1. 关闭 VS Code 或关闭工作区
2. 重新打开 `test-project`
3. 等待插件加载
4. 查看日志：
   - 应显示：`Scan strategy: INCREMENTAL (use history)`
   - 显示上次扫描时间和跳过文件数
   - 扫描速度应该明显更快（<1秒 vs 之前2-3秒）

### 5. 边缘场景测试

#### 测试 5.1：路径结尾带斜杠

搜索 `/` 验证：
- `/api/categories/` + `/{id}` → 应正确拼接为 `/api/categories/{id}`
- `/api/reports/` + `/test/` → 应找到 `/api/reports/test/`

#### 测试 5.2：多HTTP方法同路径

搜索 `/items`：
- 应找到多个方法：GET、POST、PUT（都映射到 `/api/v2/items`）

#### 测试 5.3：条件映射

搜索 `header-test` 或 `advanced`：
- 验证 headers、params、consumes/produces 条件

### 6. 性能观察

对比首次扫描和增量扫描时间：

**首次扫描**：
- 记录扫描文件数和时间

**增量扫描**：
- 重启项目后的扫描时间
- 应该显著减少（跳过大部分文件）

### 7. 日志验证

查看完整的扫描过程日志：

1. Output → RestfulToolkit
2. 应包含：
   - 扫描模式（FULL/INCREMENTAL）
   - 扫描文件数
   - 跳过文件数（增量模式）
   - 每个文件的端点数
   - 保存扫描状态记录

## 测试清单

### ✅ 核心功能验证
- [ ] 多路径注解定位准确（active/enabled → 第34行）
- [ ] 搜索功能正常（路径、类名、方法名、HTTP方法）
- [ ] 文件跳转准确（行号正确）
- [ ] 新增测试文件端点都能找到

### ✅ 增量扫描验证
- [ ] 首次扫描成功（全量）
- [ ] 重启项目增量扫描（跳过未修改文件）
- [ ] 手动增量刷新成功
- [ ] 文件修改实时更新

### ✅ 新测试用例验证
- [ ] CategoryController - 结尾带斜杠路径
- [ ] ApiV2Controller - 正则路径和嵌套路径
- [ ] ItemController - 类级别多路径
- [ ] HealthController - 无类级别路径
- [ ] NestedPathController - 三层嵌套
- [ ] ReportResource - JAX-RS结尾带斜杠

### ✅ 边缘场景验证
- [ ] 路径拼接正确（斜杠处理）
- [ ] 多路径注解（行号一致）
- [ ] 正则路径变量解析
- [ ] 多HTTP方法同路径

## 问题记录

如果发现问题，请记录：

1. **问题描述**：具体什么功能不正常
2. **预期结果**：应该是什么
3. **实际结果**：实际发生什么
4. **截图/日志**：相关日志输出
5. **文件路径**：涉及的具体文件

## 测试完成

完成所有测试后，请反馈：

- ✅ 通过的功能
- ❌ 发现的问题
- 💡 改进建议

---

**开始测试！按 Ctrl+\ 开始搜索端点。**