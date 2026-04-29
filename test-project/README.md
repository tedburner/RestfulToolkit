# RestfulToolkit 测试项目

这是一个精简的测试项目，用于验证 RestfulToolkit 扩展的核心功能。

## 测试脚本说明

### 1. 自动化验证脚本（推荐）

**位置**: `scripts/test-all-files.js`

**运行方法**：
```bash
cd F:\Project\person\restful-toolkit
node src/test/scripts/test-all-files.js
```

**验证内容**：
- ✅ 端点识别数量统计：49个端点
- ✅ 行号定位准确性验证：100%准确
- ✅ 多路径拆分正确性：7个端点来自3个注解
- ✅ Kotlin文件支持：4个端点
- ✅ 框架分布统计：Spring 44个, JAX-RS 5个
- ✅ 路径拼接问题检测：无异常

**输出示例**：
```
=== 测试结果汇总 ===
📊 总端点数: 49
✅ 行号正确: 49 (100%)
❌ 行号错误: 0 (0%)
⚠️  路径异常: 0

=== 框架与语言分布 ===
📊 Spring MVC 端点: 44 (90%)
📊 JAX-RS 端点: 5 (10%)
📊 Kotlin 端点: 4 (8%)
📊 Java 端点: 45 (92%)

=== 多路径统计 ===
📊 多路径拆分端点数: 7 个
📊 多路径注解数: 3 个注解
📊 多路径拆分比例: 14%
```

### 2. 单元测试（Mocha）

**位置**: `../src/test/` 目录

**运行方法**：
```bash
cd F:\Project\person\restful-toolkit
npm test
```

**测试覆盖**：Spring MVC解析、JAX-RS解析、缓存管理

### 3. VS Code功能测试

在VS Code扩展开发主机中进行交互测试，详见 `docs/TESTING_GUIDE.md`

## 快速测试

**自动化测试脚本**：
```bash
cd F:\Project\person\restful-toolkit
node src/test/scripts/test-all-files.js
```

输出包括：
- 端点识别数量统计
- 行号定位准确性验证
- 详细错误报告
- 路径拼接问题检测

## 项目结构

```
test-project/
└── src/
    └── main/
        ├── java/
        │   └── com/example/controller/
        │       ├── CoreAcceptanceController.java  (验收测试核心)
        │       ├── UserController.java            (Spring MVC 基础)
        │       ├── ProductController.java         (Spring MVC CRUD)
        │       ├── OrderResource.java             (JAX-RS 测试)
        │       └── CategoryController.java        (结尾斜杠场景)
        └── kotlin/
            └── com/example/
                └── ItemController.kt              (Kotlin + Spring)
```

## 包含的端点

### CoreAcceptanceController (验收测试) - 12 个端点
- 跨行注解：2 个端点
- 多路径注解：5 个端点（2+3）
- 行号验证：4 个端点
- 复杂参数：2 个端点

### UserController (Spring MVC) - 8 个端点
- GET    /api/users
- GET    /api/users/{id}
- POST   /api/users
- PUT    /api/users/{id}
- DELETE /api/users/{id}
- GET    /api/users/active  (多路径)
- GET    /api/users/enabled (多路径)
- POST   /api/users/batch

### ProductController (Spring MVC) - 6 个端点
- GET    /api/products
- GET    /api/products/{id}
- POST   /api/products
- PUT    /api/products/{id}
- DELETE /api/products/{id}
- GET    /api/products/category/{category}

### OrderResource (JAX-RS) - 6 个端点
- GET    /api/orders
- GET    /api/orders/{id}
- POST   /api/orders/create
- PUT    /api/orders/{id}
- DELETE /api/orders/{id}
- GET    /api/orders/status/{status}

### CategoryController (结尾斜杠测试) - 6 个端点
- GET    /api/categories/
- GET    /api/categories/{id}
- GET    /api/categories/test/
- GET    /api/categories/nested/{categoryId}/products
- POST   /api/categories/
- PUT    /api/categories/{id}

### ItemController (Kotlin) - 6 个端点
- GET    /api/items
- GET    /api/items/{id}
- POST   /api/items
- PUT    /api/items/{id}
- DELETE /api/items/{id}
- GET    /api/items/special

**总计**: 44 个 REST 端点

## 核心测试场景

### 1. 验收测试（本次修改）
搜索关键词：`multiline`, `multipath`, `linetest`, `complex`
- 跨行注解解析
- 行号精确定位
- 多路径注解拆分
- 嵌套括号参数处理

### 2. Spring MVC 基础功能
搜索关键词：`users`, `products`
- CRUD 端点识别
- 路径变量支持
- 多路径注解

### 3. JAX-RS 支持
搜索关键词：`orders`
- JAX-RS 注解解析
- 基础端点识别

### 4. 边界情况
搜索关键词：`categories`
- 结尾斜杠路径拼接
- 类级别 RequestMapping

### 5. Kotlin 支持
搜索关键词：`items`
- Kotlin 文件解析
- Spring 注解支持

## 测试步骤

### 1. 启动扩展开发主机

在主项目目录中：
1. 按 **F5** 启动调试
2. 等待新窗口打开（标题显示 "[Extension Development Host]"）

### 2. 打开测试项目

在新窗口中：
1. 打开文件夹：选择 `test-project` 目录
2. 等待扩展自动扫描（状态栏显示进度）

### 3. 测试搜索功能

按 **Ctrl+Alt+N** 或 **Ctrl+\** 触发搜索：

- 输入 "users" → 应看到 UserController 的所有端点
- 输入 "products" → 应看到 ProductController 的所有端点
- 输入 "orders" → 应看到 OrderResource 的所有端点
- 输入 "items" → 应看到 ItemController 的所有端点
- 输入 "GET" → 应看到所有 GET 端点
- 输入 "UserController" → 应看到 UserController 的所有端点
- 输入空查询 → 应看到全部 26 个端点

### 4. 测试导航功能

在搜索结果中：
1. 选择任意端点，按 Enter
2. 文件应打开并跳转到方法定义行
3. 方法被选中高亮

### 5. 测试实时更新

修改文件：
1. 在任意 Controller 中添加新方法
2. 保存文件
3. 再次搜索，新端点应出现在结果中

删除端点：
1. 删除一个方法
2. 保存文件
3. 搜索结果中应移除该端点

### 6. 测试多路径

搜索 "active" 或 "enabled"：
- 应匹配到同一个方法 `getActiveUsers()`
- 显示两个路径：/api/users/active 和 /api/users/enabled

### 7. 测试路径变量

搜索带有路径变量的端点：
- 搜索 "{id}" → 应匹配所有带 {id} 的端点
- 搜索 "category" → 应匹配 /api/products/category/{category}

### 8. 查看 HTTP 方法图标

验证不同 HTTP 方法的图标颜色：
- 🟢 GET 端点
- 🔵 POST 端点
- 🟡 PUT 端点
- 🔴 DELETE 端点

### 9. 测试框架识别

查看端点的 framework 字段：
- UserController, ProductController → 显示 "Spring"
- OrderResource → 显示 "JAX-RS"
- ItemController → 显示 "Spring"

### 10. 测试手动刷新

按 Ctrl+Shift+P，输入 "RestfulToolkit: Refresh Endpoints"：
- 应显示刷新进度
- 完成后显示端点总数

## 预期结果

✅ **扫描结果**: 26 个端点被扫描到
✅ **搜索响应**: 实时过滤，结果按相关性排序
✅ **导航准确**: 跳转到正确的文件和行号
✅ **图标显示**: 不同 HTTP 方法有不同颜色图标
✅ **框架识别**: 正确识别 Spring 和 JAX-RS
✅ **实时更新**: 文件修改后自动更新缓存
✅ **多路径支持**: 正确拆分多路径注解
✅ **路径变量**: 正确提取路径模板
✅ **Kotlin 支持**: 正确解析 Kotlin 文件

## 故障排除

如果测试失败：

### 扫描未触发
- 检查文件路径是否正确（src/main/java 或 src/main/kotlin）
- 查看输出通道日志
- 尝试手动刷新

### 端点未显示
- 确认注解格式正确
- 检查扫描路径配置
- 查看日志中的警告信息

### 跳转位置不准确
- 这是已知限制，注解跨多行时行号可能偏差
- 检查方法定义前是否有空行或注释

---

开始测试吧！🚀