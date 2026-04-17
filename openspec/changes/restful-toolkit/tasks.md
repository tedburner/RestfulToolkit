## 1. 项目初始化

- [x] 1.1 使用 TypeScript 初始化 VS Code 扩展项目
- [x] 1.2 配置 package.json 扩展清单（名称、版本、命令、快捷键绑定）
- [x] 1.3 设置 TypeScript 构建配置（tsconfig.json, webpack/vite）
- [x] 1.4 创建基础扩展激活处理器（activate/deactivate 函数）
- [x] 1.5 配置扩展贡献点（commands, keybindings, menus）

## 2. 核心基础设施

- [x] 2.1 定义 RestEndpoint 接口数据模型（method, path, className, methodName, file, line, framework）
- [x] 2.2 实现 EndpointCache 类，使用 Map 存储结构
- [x] 2.3 添加缓存查询方法（search, getByFile, add, removeByFile, updateFile）
- [x] 2.4 设置 VS Code 工作区文件系统监听器（创建、修改、删除事件）
- [x] 2.5 创建日志工具，支持 INFO/WARNING/ERROR 级别

## 3. 注解解析

- [x] 3.1 实现 Spring MVC 类级别 @RequestMapping 正则解析器
- [x] 3.2 实现 Spring MVC 方法级别映射解析器（@GetMapping, @PostMapping, @PutMapping, @DeleteMapping, @PatchMapping）
- [x] 3.3 实现 @RequestMapping 带 method 参数的解析器（RequestMethod.GET 等）
- [x] 3.4 处理多种注解参数格式（value=, path=, 省略属性名）
- [x] 3.5 处理注解参数顺序变化（path/method 顺序不同）
- [x] 3.6 实现多路径注解处理（value = {"/users", "/list"}）
- [x] 3.7 实现 JAX-RS @Path, @GET, @POST, @PUT, @DELETE 解析器
- [x] 3.8 实现两个框架的类级别 + 方法级别路径组合逻辑
- [x] 3.9 添加元数据提取（className, methodName, file path, line number, framework type）
- [x] 3.10 处理 Kotlin 注解语法变体（括号、简化语法）
- [x] 3.11 添加注解解析错误处理（跳过格式异常的注解，记录警告）

## 4. 文件扫描

- [x] 4.1 实现 src/main/java/**/*.java 模式的文件扫描器
- [x] 4.2 实现 src/main/kotlin/**/*.kt 模式的文件扫描器
- [x] 4.3 从扩展设置添加可配置的扫描路径
- [x] 4.4 实现文件内容读取器，支持 UTF-8 编码
- [x] 4.5 将注解解析器集成到文件扫描工作流
- [x] 4.6 在扩展激活时实现异步初始扫描
- [x] 4.7 在 VS Code 状态栏添加扫描进度指示器
- [x] 4.8 实现文件创建事件处理器（扫描新文件，添加到缓存）
- [x] 4.9 实现文件修改事件处理器（重新扫描文件，更新缓存）
- [x] 4.10 实现文件删除事件处理器（从缓存中移除）
- [x] 4.11 添加防抖机制处理快速文件变更，避免重复扫描
- [x] 4.12 实现手动刷新命令（清空缓存，全量重新扫描）
- [x] 4.13 添加文件读取错误处理（权限/编码错误时跳过文件）

## 5. 缓存管理

- [x] 5.1 实现端点存储到缓存，使用路径和文件索引
- [x] 5.2 添加重复端点处理（来自不同方法的相同路径）
- [x] 5.3 实现缓存清空方法用于手动刷新
- [x] 5.4 添加多工作区支持（每个工作区文件夹独立缓存）
- [x] 5.5 实现工作区文件夹移除处理（清除对应缓存）

## 6. 搜索 UI

- [x] 6.1 使用 VS Code window.createQuickPick API 实现 QuickPick 搜索界面
- [x] 6.2 设计 QuickPick 项显示格式（label, description, detail）
- [x] 6.3 添加 HTTP 方法图标和颜色编码（GET=绿色, POST=蓝色, PUT=黄色, DELETE=红色, PATCH=紫色）
- [x] 6.4 实现模糊搜索匹配算法（path, className, methodName, httpMethod）
- [x] 6.5 为搜索结果添加权重评分（path=0.4, class=0.3, method=0.2, http=0.1）
- [x] 6.6 实现用户输入时的实时搜索过滤
- [x] 6.7 添加按相关性分数排序搜索结果
- [x] 6.8 限制显示结果为 100 项，显示溢出提示消息
- [x] 6.9 处理空查询（显示所有端点）

## 7. 代码导航

- [x] 7.1 实现 QuickPick 项选择处理器
- [x] 7.2 使用 VS Code workspace.openTextDocument API 添加文件打开逻辑
- [x] 7.3 使用编辑器选择 API 实现跳转到行号功能
- [x] 7.4 处理已打开的文件（切换到现有标签页而不是新建）
- [x] 7.5 添加文件缺失的错误处理（显示用户通知）

## 8. 测试

- [x] 8.1 为 Spring MVC 注解解析创建测试套件（各种格式）
- [x] 8.2 为 JAX-RS 注解解析创建测试套件
- [x] 8.3 为 Kotlin 注解语法创建测试套件
- [x] 8.4 为多路径注解处理创建测试套件
- [x] 8.5 为路径组合逻辑（类 + 方法）创建测试套件
- [x] 8.6 为搜索匹配算法创建测试套件
- [x] 8.7 为缓存管理操作创建测试套件
- [x] 8.8 使用示例项目（100+ 文件）测试文件扫描性能
- [x] 8.9 测试文件变更检测和缓存更新
- [x] 8.10 测试多工作区场景

## 9. 文档

- [x] 9.1 创建 README.md 包含安装说明
- [x] 9.2 文档支持的框架和注解
- [x] 9.3 文档支持的文件类型和扫描路径
- [x] 9.4 文档键盘快捷键和命令面板使用
- [x] 9.5 文档扩展设置和配置选项
- [x] 9.6 文档已知限制（继承关系、动态路径、${} 变量）
- [x] 9.7 创建 CHANGELOG.md 用于版本历史记录