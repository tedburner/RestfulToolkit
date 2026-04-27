# 接口参数复制功能设计

**日期**: 2026-04-27
**状态**: Draft

## 1. 目标

用户在 Spring MVC 或 JAX-RS Controller/Resource 文件中右键点击方法，能够复制该接口方法的所有参数，支持多种格式（URL Params、JSON Body、Form Data、x-www-form-urlencoded），支持命名格式转换（驼峰/蛇形）。

## 2. 非目标

- **不修改现有 `RestEndpoint` 模型、缓存层、搜索 UI**
- **不支持运行时 Spring 容器集成**（纯静态源码解析）
- **不支持继承的参数或父类中的参数**

## 2.1 框架支持范围

- **Spring MVC**: 完全支持
- **Spring WebFlux**: 完全支持（与 Spring MVC 共用 `@GetMapping`、`@RequestParam` 等注解，仅返回值类型不同，参数提取不受影响）
- **JAX-RS**: 完全支持
- **Kotlin Controller**: 通过现有 `preprocessKotlin` 预处理支持

## 3. 架构

### 3.1 数据流

```
用户右键 Java/Kotlin 文件 → VS Code Context Menu
        ↓
Command: restfulToolkit.copyEndpointParameters
        ↓
ParameterExtractor.extract(document, cursorPosition)
        ↓
  识别框架（Spring / JAX-RS）
  正则匹配光标所在方法的参数注解
        ↓
  EndpointCopyInfo { httpMethod, contentType, parameters[] }
        ↓
  autoDetectFormat() → 默认格式
        ↓
  QuickPick 弹出格式选择（高亮默认项）
        ↓
  用户确认 → 应用命名转换 → 生成字符串
        ↓
  vscode.env.clipboard.writeText()
  通知 "✓ 已复制到剪贴板"
```

### 3.2 核心组件

#### ParameterExtractor (`src/extractor/ParameterExtractor.ts`)

- 入口类，接收 VS Code TextDocument + Position
- 判断当前文件是 Spring 还是 JAX-RS（通过 import 语句或注解检测）
- 从光标位置向前找到方法签名，向后提取完整方法体范围
- 提取方法前的所有参数注解（类似 Parser 中 `getAnnotationBlock` 的逻辑）
- 委托给 `SpringParameterParser` 或 `JaxRsParameterParser`

#### SpringParameterParser (`src/extractor/SpringParameterParser.ts`)

解析以下注解：

| 注解 | source 映射 | 说明 |
|------|------------|------|
| `@RequestParam` | query | 可选 name/value 属性 |
| `@PathVariable` | path | 可选 name 属性 |
| `@RequestBody` | body | 可选嵌套 DTO 展开 |
| `@RequestPart` | form | multipart/form-data 场景 |
| `@ModelAttribute` | form | form 提交场景 |

参数提取规则：
1. 注解有 `name` 或 `value` 属性 → 使用该值作为参数名
2. 否则使用方法参数变量名
3. 提取参数类型（如 `String`, `Long`, `UserDto`）

#### JaxRsParameterParser (`src/extractor/JaxRsParameterParser.ts`)

解析以下注解：

| 注解 | source 映射 | 说明 |
|------|------------|------|
| `@PathParam("name")` | path | JAX-RS 路径参数 |
| `@QueryParam("name")` | query | JAX-RS 查询参数 |
| `@FormParam("name")` | form | JAX-RS 表单参数 |
| `@RequestBody`（同 Spring） | body | JSON body |

#### FormatConverter (`src/extractor/FormatConverter.ts`)

将 `EndpointCopyInfo` 转为字符串输出：

| 格式 | 输出 | 示例 |
|------|------|------|
| url-params | `?key1=&key2=` | `?id=&name=` |
| json-quick | `{"key1": "", "key2": ""}` | `{"userDto": ""}` |
| json-expand | 递归展开 DTO 字段 | `{"id": "", "address": {"street": ""}}` |
| form-data | `key1: \nkey2: ` | `file: \ndescription: ` |
| x-www-form-urlencoded | `key1=&key2=` | `username=&password=` |

#### NameTransformer (`src/extractor/NameTransformer.ts`)

命名格式转换工具：

```typescript
function toSnakeCase(name: string): string  // userName → user_name
function toCamelCase(name: string): string  // user_name → userName（保持首字母小写）
```

**`@JsonProperty` / `@JSONField` 优先级规则**：

1. 参数注解有显式 name/value（如 `@RequestParam("user_name")`）→ 使用显式值，**不受转换影响**
2. 参数注解无显式名，但类型是 DTO 且 DTO 字段有 `@JsonProperty` → JSON 展开时使用注解值
3. 参数注解无显式名，且无 `@JsonProperty` → 根据用户选择的命名格式转换

```
// 示例
@RequestBody UserDto userDto
```

驼峰模式（默认）：`{"userDto": ""}`
蛇形模式：`{"user_dto": ""}`

```
// DTO 字段展开时
class UserDto {
    private String userName;          // 驼峰 → userName
    @JsonProperty("email_addr")       // 显式注解 → email_addr（不受转换影响）
    private String email;
}
```

JSON 展开结果：`{"userName": "", "email_addr": "", ...}`

### 3.3 数据结构

```typescript
interface EndpointParameter {
    name: string;              // 最终参数名（考虑 @JsonProperty 等）
    type: string;              // Java 类型
    source: 'path' | 'query' | 'body' | 'form';
    originalCaseName: string;  // Java 原始变量名
    isRequired: boolean;       // 是否必填（@RequestParam 默认 true）
    defaultValue?: string;     // defaultValue 属性值
}

interface EndpointCopyInfo {
    httpMethod: string;         // GET/POST/PUT/DELETE/PATCH
    contentType: string;        // json | form-data | x-www-form-urlencoded | url-params
    path: string;               // 接口路径
    parameters: EndpointParameter[];
    framework: 'Spring' | 'JAX-RS';
}
```

## 4. 交互设计

### 4.1 右键菜单

`package.json` 注册：

```json
"menus": {
    "editor/context": [
        {
            "command": "restfulToolkit.copyEndpointParameters",
            "when": "resourceLangId =~ /java|kotlin/",
            "group": "navigation"
        }
    ]
}
```

### 4.2 格式选择 QuickPick

```
┌──────────────────────────────────────────────┐
│ 复制接口参数 / Copy Endpoint Parameters       │
│──────────────────────────────────────────────│
│ > 🔗 URL Params                    ✓ 默认    │  ← 系统检测
│   📦 JSON Body (快捷 / Quick)                │
│   📦 JSON Body (展开 / Expand)               │
│   📝 Form Data                               │
│   📝 x-www-form-urlencoded                   │
│──────────────────────────────────────────────│
│ 命名格式: [ 驼形 (camelCase) ▼ ]             │
└──────────────────────────────────────────────┘
```

**自动检测逻辑**：

```
if HTTP method in (GET, DELETE)       → url-params
if @RequestBody present               → json-quick
if consumes contains multipart/*      → form-data
if consumes contains form-urlencoded  → x-www-form-urlencoded
if HTTP method in (POST, PUT, PATCH)  → json-quick
else                                  → null (用户自选)
```

### 4.3 国际化

**语言检测**：通过 `vscode.env.language` 获取当前 VS Code 界面语言。
- `zh-cn` / `zh-tw` → 显示中文标签
- 其他所有语言（`en`, `ja`, `fr`, `ko` 等）→ 默认显示英文标签

```typescript
// src/extractor/i18n.ts
const locale = vscode.env.language;
const LABELS = locale.startsWith('zh') ? {
    title: '复制接口参数',
    urlParams: 'URL Params',
    jsonQuick: 'JSON Body (快捷)',
    jsonExpand: 'JSON Body (展开)',
    formData: 'Form Data',
    formUrlencoded: 'x-www-form-urlencoded',
    nameFormat: '命名格式',
    camelCase: '驼峰 (camelCase)',
    snakeCase: '蛇形 (snake_case)',
    copied: '✓ 已复制到剪贴板',
    noParams: '该方法没有可复制的参数',
    copy: '复制',
    cancel: '取消',
    parseError: '参数解析失败: {0}'
} : {
    title: 'Copy Endpoint Parameters',
    urlParams: 'URL Params',
    jsonQuick: 'JSON Body (Quick)',
    jsonExpand: 'JSON Body (Expand)',
    formData: 'Form Data',
    formUrlencoded: 'x-www-form-urlencoded',
    nameFormat: 'Name Format',
    camelCase: 'camelCase',
    snakeCase: 'snake_case',
    copied: '✓ Copied to clipboard',
    noParams: 'No copyable parameters found',
    copy: 'Copy',
    cancel: 'Cancel',
    parseError: 'Failed to parse parameters: {0}'
};
```

## 5. 错误处理

| 场景 | 处理 |
|------|------|
| 光标不在方法上 | 提示 "请将光标放在接口方法上" |
| 方法无参数注解 | 提示 "该方法没有可复制的参数" |
| 解析失败（正则不匹配） | 提示错误信息，不崩溃 |
| DTO 展开失败（找不到类文件） | 降级为 JSON 快捷格式 |
| 非 Controller 文件 | 提示 "未检测到 REST 端点" |

## 6. 配置

`package.json` 新增配置：

```json
{
    "restfulToolkit.copyNameFormat": {
        "type": "string",
        "enum": ["camelCase", "snake_case"],
        "default": "camelCase",
        "description": "Default name format for copied parameters"
    }
}
```

## 7. 文件清单

| 文件 | 说明 |
|------|------|
| `src/extractor/ParameterExtractor.ts` | 主入口，坐标解析，格式检测 |
| `src/extractor/SpringParameterParser.ts` | Spring 参数注解解析 |
| `src/extractor/JaxRsParameterParser.ts` | JAX-RS 参数注解解析 |
| `src/extractor/FormatConverter.ts` | 格式转换（URL Params, JSON, Form Data 等） |
| `src/extractor/NameTransformer.ts` | 驼峰/蛇形转换 |
| `src/extractor/i18n.ts` | 多语言标签 |
| `src/commands/CopyEndpointParametersCommand.ts` | 命令注册 + QuickPick UI |
| `package.json` | 新增 command + contextMenu + config |

## 8. 测试

### 8.1 单元测试

`src/test/extractor/` 下测试各 Parser 和 Converter。

### 8.2 Test Project 测试用例

在 `test-project/src/main/java/com/example/controller/` 新增以下文件/修改：

#### 8.2.1 `ParameterDemoController.java`（Spring MVC 综合测试）

覆盖以下场景：
- `@RequestParam` 裸写：`@RequestParam String keyword`
- `@RequestParam` 显式 name：`@RequestParam("user_name") String userName`
- `@RequestParam` 含 defaultValue/required：`@RequestParam(value = "page", defaultValue = "1") int page`
- `@PathVariable` 裸写：`@PathVariable Long id`
- `@PathVariable` 显式 name：`@PathVariable("user_id") Long userId`
- `@RequestBody` 无注解：`@RequestBody UserDto userDto`
- `@RequestBody` 含 `@JsonProperty` 的 DTO（见 8.3）
- 混合参数：`@PathVariable` + `@RequestParam` + `@RequestBody`
- `@RequestPart` multipart：`@RequestPart("file") MultipartFile file`
- `@ModelAttribute` form：`@ModelAttribute LoginForm form`
- `consumes = MediaType.MULTIPART_FORM_DATA_VALUE` 检测
- `consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE` 检测

#### 8.2.2 `ParameterDemoResource.java`（JAX-RS 综合测试）

覆盖以下场景：
- `@PathParam("id")` 显式 name
- `@QueryParam("name")` 显式 name
- `@FormParam("username")` 表单参数
- 多参数组合

#### 8.2.3 修改现有文件

- `ItemController.java` — 增加 `@RequestParam` with name/defaultValue 用例
- `OrderResource.java` — 增加 `@QueryParam` 用例

### 8.3 DTO 测试文件

在 `test-project/src/main/java/com/example/dto/` 新增：

#### `UserDto.java`
```java
public class UserDto {
    private Long id;
    private String userName;           // 驼峰，无注解
    @JsonProperty("email_addr")        // 显式蛇形注解
    private String email;
    private String phone;
}
```

#### `LoginForm.java`
```java
public class LoginForm {
    @JsonProperty("user_name")
    private String userName;
    private String password;
}
```

### 8.4 手动验证点

| # | 测试点 | 预期 |
|---|--------|------|
| 1 | 右键 `@RequestParam String keyword` 方法 | URL Params: `?keyword=` |
| 2 | 右键 `@RequestParam("user_name") String userName` | URL Params: `?user_name=` |
| 3 | 右键 `@RequestBody UserDto userDto` | JSON: `{"userDto": ""}` |
| 4 | 右键 `@PathVariable("user_id") Long userId` | URL Params 含路径变量 |
| 5 | 右键 multipart 方法 | Form Data 格式 |
| 6 | 右键 form-urlencoded 方法 | `key1=&key2=` 格式 |
| 7 | 右键 JAX-RS `@PathParam` 方法 | 路径变量解析 |
| 8 | 右键无参数方法 | 提示"没有可复制的参数" |
| 9 | 右键非 Controller 方法 | 提示"未检测到 REST 端点" |
| 10 | 选择蛇形命名 | `userName` → `user_name` |
| 11 | 选择 `@JsonProperty` 字段展开 | 使用注解值 `email_addr` |
| 12 | VS Code 语言为中文时 | 界面显示中文标签 |
| 13 | VS Code 语言为英文/其他时 | 界面显示英文标签 |

### 8.5 验证脚本

在 `test-project/scripts/test-all-files.js` 中新增参数复制相关的验证测试。

## 9. Postman / Apifox 兼容性

所有输出格式设计为可直接粘贴到 Postman/Apifox：

| 格式 | 粘贴位置 | 兼容方式 |
|------|---------|---------|
| URL Params `?key=&value=` | 浏览器地址栏 / Postman URL 输入框 | 自动解析为 Params |
| JSON Body `{"key": ""}` | Postman Body → Raw → JSON | 直接粘贴 |
| Form Data `key: value` | Postman Body → form-data → Bulk Edit | key:value 格式识别 |
| x-www-form-urlencoded `key1=&key2=` | Postman Body → x-www-form-urlencoded → Bulk Edit | 直接粘贴 |
