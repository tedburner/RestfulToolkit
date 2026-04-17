# Restful Search Specification

## ADDED Requirements

### Requirement: 用户可以通过快捷键触发搜索界面

系统 SHALL 提供快捷键触发 RESTful 端点搜索界面。

#### Scenario: 使用快捷键触发搜索
- **WHEN** 用户按下 Ctrl\ 或 Ctrl+Alt+N (Windows/Linux)
- **THEN** 系统打开 QuickPick 搜索界面,显示所有已扫描的 RESTful 端点列表

#### Scenario: Mac 用户使用快捷键触发搜索
- **WHEN** Mac 用户按下 Cmd\ 或 Cmd+Alt+N
- **THEN** 系统打开 QuickPick 搜索界面

### Requirement: 搜索界面显示端点列表

系统 SHALL 在搜索界面中显示所有扫描到的 RESTful 端点。

#### Scenario: 显示完整端点列表
- **WHEN** 搜索界面打开时
- **THEN** 系统显示所有已扫描的 RESTful 端点,包含以下信息:
  - HTTP 方法(GET/POST/PUT/DELETE/PATCH)
  - 完整路径(如 /api/users)
  - 类名和方法名(如 UserController.listUsers)
  - 文件路径
  - 框架类型(Spring/JAX-RS)

#### Scenario: 为不同 HTTP 方法显示不同图标
- **WHEN** 端点列表显示时
- **THEN** 不同 HTTP 方法的端点使用不同颜色图标:
  - GET: 绿色图标
  - POST: 蓝色图标
  - PUT: 黄色图标
  - DELETE: 纅色图标
  - PATCH: 紫色图标

### Requirement: 支持模糊匹配搜索

系统 SHALL 支持多字段模糊匹配搜索。

#### Scenario: 路径模糊匹配
- **WHEN** 用户输入搜索查询 "users"
- **THEN** 系统匹配包含 "users" 的路径,如:
  - /api/users
  - /api/user-management
  - /admin/users/list

#### Scenario: 类名模糊匹配
- **WHEN** 用户输入搜索查询 "UserCtrl"
- **THEN** 系统匹配类名包含 "UserCtrl" 或 "UserController" 的端点

#### Scenario: 方法名模糊匹配
- **WHEN** 用户输入搜索查询 "list"
- **THEN** 系统匹配方法名包含 "list" 的端点,如 listUsers, listAll

#### Scenario: HTTP 方法精确匹配
- **WHEN** 用户输入搜索查询 "GET"
- **THEN** 系统只显示 HTTP 方法为 GET 的端点

#### Scenario: 综合查询匹配
- **WHEN** 用户输入搜索查询 "GET users"
- **THEN** 系统显示 HTTP 方法为 GET 且路径包含 "users" 的端点

### Requirement: 搜索结果实时更新

系统 SHALL 在用户输入时实时更新搜索结果。

#### Scenario: 输入过程中实时过滤
- **WHEN** 用户在搜索框中逐字输入查询
- **THEN** 系统实时过滤和更新显示的端点列表,无需等待用户按 Enter

#### Scenario: 空查询显示全部
- **WHEN** 用户清空搜索框
- **THEN** 系统显示所有已扫描的端点

### Requirement: 搜索结果按相关性排序

系统 SHALL 按匹配分数对搜索结果排序。

#### Scenario: 最佳匹配显示在最前
- **WHEN** 用户搜索 "api/users"
- **THEN** 系统按以下权重计算匹配分数并排序:
  - 路径匹配权重: 0.4
  - 类名匹配权重: 0.3
  - 方法名匹配权重: 0.2
  - HTTP 方法匹配权重: 0.1
  - 完全匹配路径 /api/users 的端点排在最前

#### Scenario: 部分匹配排在次优位置
- **WHEN** 搜索结果包含完全匹配和部分匹配
- **THEN** 完全匹配的端点显示在前,部分匹配的显示在后

### Requirement: 限制显示结果数量

系统 SHALL 限制搜索结果显示数量以保证性能。

#### Scenario: 大量结果时限制显示
- **WHEN** 搜索匹配超过 100 个端点
- **THEN** 系统只显示前 100 个最佳匹配结果

#### Scenario: 显示结果数量提示
- **WHEN** 搜索结果超过限制数量
- **THEN** 系统显示提示信息"显示前 100 个结果,共找到 X 个匹配"

### Requirement: 用户可选择端点并跳转

系统 SHALL 允许用户从搜索结果中选择端点并跳转到代码定义。

#### Scenario: 选择端点跳转
- **WHEN** 用户在搜索结果中选择某个端点
- **THEN** 系统打开对应的文件并跳转到 Controller 方法的行号

#### Scenario: 跳转后高亮方法
- **WHEN** 系统打开文件并跳转到方法
- **THEN** 编辑器光标定位在方法定义行,方法被高亮选中

#### Scenario: 文件已在编辑器打开
- **WHEN** 目标文件已在编辑器中打开
- **THEN** 系统切换到该文件标签页并跳转到方法行号

### Requirement: 支持命令面板触发搜索

系统 SHALL 支持通过命令面板触发搜索。

#### Scenario: 从命令面板触发
- **WHEN** 用户打开命令面板(Ctrl+Shift+P)并输入 "RestfulToolkit: Search REST Endpoints"
- **THEN** 系统打开 QuickPick 搜索界面

### Requirement: 搜索界面显示元数据

系统 SHALL 在搜索界面显示每个端点的完整元数据。

#### Scenario: 显示端点详细信息
- **WHEN** 端点列表显示时
- **THEN** 每个端点项显示三行信息:
  - 第一行(Label): [GET] /api/users - UserController.listUsers()
  - 第二行(Description): src/main/java/com/example/UserController.java
  - 第三行(Detail): Spring MVC