# Annotation Parsing Specification

## ADDED Requirements

### Requirement: 解析 Spring MVC 注解

系统 SHALL 解析 Spring MVC/Spring Boot 的 REST 注解。

#### Scenario: 解析类级别 @RequestMapping
- **WHEN** 扫描包含 `@RequestMapping("/api")` 注解的 Controller 类
- **THEN** 系统提取类路径前缀 "/api" 作为所有方法路径的基础

#### Scenario: 解析方法级别 @GetMapping
- **WHEN** 扫描包含 `@GetMapping("/users")` 注解的方法
- **THEN** 系统提取 HTTP 方法 "GET" 和方法路径 "/users"

#### Scenario: 解析方法级别 @PostMapping
- **WHEN** 扫描包含 `@PostMapping(value = "/create")` 注解的方法
- **THEN** 系统提取 HTTP 方法 "POST" 和方法路径 "/create"

#### Scenario: 解析 @PutMapping, @DeleteMapping, @PatchMapping
- **WHEN** 扫描包含这些注解的方法
- **THEN** 系统正确提取对应的 HTTP 方法(PUT/DELETE/PATCH)和路径

#### Scenario: 解析完整 @RequestMapping 注解
- **WHEN** 扫描包含 `@RequestMapping(path = "/list", method = RequestMethod.GET)` 的方法
- **THEN** 系统提取路径 "/list" 和 HTTP 方法 "GET"

#### Scenario: 组合类和方法级别路径
- **WHEN** Controller 类有 `@RequestMapping("/api")` 且方法有 `@GetMapping("/users")`
- **THEN** 系统组合路径为完整端点 "/api/users", HTTP 方法为 "GET"

### Requirement: 处理多种注解参数格式

系统 SHALL 处理 Spring 注解的不同参数格式。

#### Scenario: 注解参数使用 value 属性
- **WHEN** 注解为 `@RequestMapping(value = "/api")`
- **THEN** 系统正确提取路径 "/api"

#### Scenario: 注解参数使用 path 属性
- **WHEN** 注解为 `@RequestMapping(path = "/api")`
- **THEN** 系统正确提取路径 "/api"

#### Scenario: 注解参数省略属性名
- **WHEN** 注解为 `@GetMapping("/users")` (省略 value=)
- **THEN** 系统正确提取路径 "/users"

#### Scenario: 注解参数顺序不固定
- **WHEN** 注解为 `@RequestMapping(method = RequestMethod.GET, path = "/list")`
- **THEN** 系统正确提取 HTTP 方法 "GET" 和路径 "/list"

#### Scenario: 注解参数跨多行
- **WHEN** 注解参数分布在多行
- **THEN** 系统正确解析多行注解,提取所有参数

### Requirement: 处理多路径注解

系统 SHALL 处理包含多个路径的注解。

#### Scenario: 注解包含路径数组
- **WHEN** 注解为 `@RequestMapping(value = {"/users", "/list"})`
- **THEN** 系统拆分为两个端点:
  - 端点 1: /users
  - 端点 2: /list
  - 两个端点指向同一个方法

#### Scenario: 多路径结合类级别路径
- **WHEN** 类有 `@RequestMapping("/api")` 且方法有 `@GetMapping({"/users", "/list"})`
- **THEN** 系统生成两个完整路径端点:
  - /api/users
  - /api/list

### Requirement: 解析 JAX-RS 注解

系统 SHALL 解析 JAX-RS 标准的 REST 注解。

#### Scenario: 解析类级别 @Path
- **WHEN** 扫描包含 `@Path("/api")` 注解的类
- **THEN** 系统提取类路径前缀 "/api"

#### Scenario: 解析方法级别 @GET, @POST 等注解
- **WHEN** 扫描包含 `@GET` 或 `@POST` 注解的方法
- **THEN** 系统提取对应的 HTTP 方法

#### Scenario: 解析方法级别 @Path
- **WHEN** 扫描包含 `@Path("/users")` 注解的方法
- **THEN** 系统提取方法路径 "/users"

#### Scenario: 组合 JAX-RS 类和方法路径
- **WHEN** 类有 `@Path("/api")` 且方法有 `@GET` 和 `@Path("/users")`
- **THEN** 系统组合为完整端点:
  - 路径: /api/users
  - HTTP 方法: GET

#### Scenario: JAX-RS 方法无 @Path 注解
- **WHEN** 类有 `@Path("/api")` 但方法只有 `@GET` 而无 `@Path`
- **THEN** 系统生成端点路径为 "/api" (类路径), HTTP 方法为 GET

### Requirement: 提取方法元数据

系统 SHALL 提取方法的完整元数据。

#### Scenario: 提取类名和方法名
- **WHEN** 扫描 Controller 方法
- **THEN** 系统提取:
  - 类名(如 UserController)
  - 方法名(如 listUsers)

#### Scenario: 提取文件路径和行号
- **WHEN** 扫描到 RESTful 端点
- **THEN** 系统记录:
  - 文件完整路径(如 src/main/java/com/example/UserController.java)
  - 方法定义的行号

#### Scenario: 识别框架类型
- **WHEN** 解析注解时
- **THEN** 系统识别端点所属框架:
  - Spring 注解: 标记为 "Spring"
  - JAX-RS 注解: 标记为 "JAX-RS"

### Requirement: 处理 Kotlin 注解语法

系统 SHALL 处理 Kotlin 语言的注解语法。

#### Scenario: Kotlin 注解与 Java 相同格式
- **WHEN** Kotlin 文件包含 `@GetMapping("/users")` 注解
- **THEN** 系统使用与 Java 相同的规则解析,提取路径 "/users"

#### Scenario: Kotlin 注解省略括号
- **WHEN** Kotlin 文件包含简化注解 `@GetMapping"/users"` (无括号)
- **THEN** 系统识别 Kotlin 特有语法,正确提取路径 "/users"

#### Scenario: Kotlin 注解使用字符串模板(限制)
- **WHEN** Kotlin 文件包含 `@GetMapping("${basePath}/users")` 注解
- **THEN** 系统在第一版可能无法正确解析,记录警告日志
  - 注: 第一版明确不支持字符串模板,后续版本改进

### Requirement: 处理无注解的 Controller 类

系统 SHALL 正确处理无类级别注解的 Controller。

#### Scenario: Controller 类无 @RequestMapping
- **WHEN** Controller 类没有类级别路径注解
- **THEN** 系统将方法级别的路径作为完整路径,不添加前缀

#### Scenario: 部分 Controller 方法有注解
- **WHEN** Controller 类包含多个方法,但只有部分方法有 REST 注解
- **THEN** 系统只提取有 REST 注解的方法作为端点,忽略其他方法

### Requirement: 处理注解继承(限制)

系统 SHALL 在第一版明确限制处理注解继承关系。

#### Scenario: 父类有 @RequestMapping 注解
- **WHEN** UserController extends BaseController,BaseController 有 `@RequestMapping("/api")`
- **THEN** 系统在第一版无法识别继承关系,可能只提取 UserController 方法的路径,遗漏父类的前缀
  - 注: 第一版明确不支持继承关系处理,后续版本改进

### Requirement: 处理注解解析错误

系统 SHALL 正确处理注解解析失败的情况。

#### Scenario: 注解格式异常
- **WHEN** 文件包含格式异常的注解(如语法错误、不完整)
- **THEN** 系统跳过该注解,记录警告日志,继续扫描其他注解

#### Scenario: 无法识别的注解类型
- **WHEN** 文件包含非 REST 相关注解(如 @Autowired, @Component)
- **THEN** 系统忽略这些注解,不尝试提取路径信息

#### Scenario: 注解参数值提取失败
- **WHEN** 注解存在但无法提取路径参数值(正则匹配失败)
- **THEN** 系统跳过该端点,记录警告日志,不阻塞整体扫描

### Requirement: 提取 Produces 和 Consumes 信息(可选)

系统 MAY 提取注解的 produces 和 consumes 参数(后续版本考虑)。

#### Scenario: 提取 produces 参数
- **WHEN** 注解包含 `@GetMapping(value = "/users", produces = "application/json")`
- **THEN** 系统提取端点返回的媒体类型 "application/json"

#### Scenario: 提取 consumes 参数
- **WHEN** 注解包含 `@PostMapping(value = "/create", consumes = "application/json")`
- **THEN** 系统提取端点接受的媒体类型 "application/json"

### Requirement: 处理动态路径变量

系统 SHALL 正确处理路径中的变量模板。

#### Scenario: 路径包含路径变量
- **WHEN** 注解为 `@GetMapping("/users/{id}")`
- **THEN** 系统提取路径模板 "/users/{id}",保持原样显示

#### Scenario: 多个路径变量
- **WHEN** 注解为 `@GetMapping("/users/{userId}/posts/{postId}")`
- **THEN** 系统提取完整路径模板 "/users/{userId}/posts/{postId}"

#### Scenario: 搜索时匹配路径变量
- **WHEN** 用户搜索 "/users/123"
- **THEN** 系统可能匹配到 "/users/{id}" (第一版可能不支持此匹配,后续改进)