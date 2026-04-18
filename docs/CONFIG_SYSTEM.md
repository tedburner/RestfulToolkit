# RestfulToolkit 配置系统

## 📋 配置优先级

RestfulToolkit 支持多种配置方式，优先级如下：

### 优先级顺序

1. **VS Code Workspace Settings**（最高优先级）
2. **项目配置文件** `.restful-toolkit.json`
3. **默认配置**（最低优先级）

---

## ⚙️ 配置方式

### 方式 1：VS Code Settings（推荐）

**快速配置**：
1. 按 `Ctrl+,` 打开设置
2. 搜索 "restfulToolkit"
3. 修改配置项

**或直接编辑 settings.json**：

按 `Ctrl+Shift+P` → 输入 "Preferences: Open Settings (JSON)"

```json
{
  "restfulToolkit.scanPaths": [
    "**/src/main/java/**/*.java",
    "**/src/main/kotlin/**/*.kt"
  ],
  "restfulToolkit.excludePaths": [
    "**/src/test/**",
    "**/target/**",
    "**/build/**"
  ],
  "restfulToolkit.maxResults": 100
}
```

---

### 方式 2：项目配置文件（团队共享）

**创建配置文件**：

按 `Ctrl+Shift+P` → 输入 "**RestfulToolkit: Create Project Config File**"

这会在项目根目录创建 `.restful-toolkit.json` 文件：

```json
{
  "scanPaths": [
    "**/src/main/java/**/*.java",
    "**/src/main/kotlin/**/*.kt"
  ],
  "excludePaths": [
    "**/src/test/**",
    "**/target/**",
    "**/build/**",
    "**/.gradle/**",
    "**/node_modules/**"
  ],
  "maxResults": 100,
  "_comment": "RestfulToolkit project configuration. Override default scan settings here."
}
```

**优点**：
- ✅ 可以提交到 Git，团队共享配置
- ✅ 不同项目可以有不同配置
- ✅ 优先级高于默认配置

---

## 📂 默认配置

**当前默认配置支持**：

### Scan Paths（扫描路径）
```json
[
  "**/src/main/java/**/*.java",
  "**/src/main/kotlin/**/*.kt"
]
```

**支持的项目类型**：
- ✅ 单模块 Maven 项目
- ✅ 多模块 Maven 项目（如 spring-ai-project）
- ✅ Gradle 项目
- ✅ 多层级嵌套项目

### Exclude Paths（排除路径）
```json
[
  "**/src/test/**",
  "**/target/**",
  "**/build/**",
  "**/.gradle/**",
  "**/node_modules/**"
]
```

---

## 🎯 常见配置场景

### 场景 1：多模块 Maven 项目

**默认配置已支持**，无需修改：

```bash
spring-ai-project/
├── spring-ai-chat/src/main/java/
├── spring-ai-vector/src/main/java/
└── spring-ai-mcp/src/main/java/
```

✅ 使用默认配置即可自动扫描所有模块

---

### 场景 2：只扫描特定模块

**配置示例**：

```json
{
  "restfulToolkit.scanPaths": [
    "spring-ai-chat/src/main/java/**/*.java",
    "spring-ai-vector/src/main/java/**/*.java"
  ]
}
```

**或创建 `.restful-toolkit.json`**：

```json
{
  "scanPaths": [
    "spring-ai-chat/src/main/java/**/*.java",
    "spring-ai-vector/src/main/java/**/*.java"
  ]
}
```

---

### 场景 3：包含 Kotlin 文件

**默认配置已包含**：

```json
[
  "**/src/main/java/**/*.java",
  "**/src/main/kotlin/**/*.kt"  // ✅ 已包含 Kotlin
]
```

---

### 场景 4：Gradle 项目

**默认配置支持**，Gradle 项目结构：

```bash
project/
├── module1/src/main/java/
├── module2/src/main/java/
└── build.gradle
```

✅ 使用默认配置即可

---

### 场景 5：自定义排除路径

**排除特定包或目录**：

```json
{
  "restfulToolkit.excludePaths": [
    "**/src/test/**",
    "**/target/**",
    "**/build/**",
    "**/legacy/**",  // 排除 legacy 代码
    "**/generated/**" // 排除生成的代码
  ]
}
```

---

## 🔄 配置生效方式

### 修改 VS Code Settings 后

1. **自动生效**：配置保存后立即生效
2. **重新扫描**：
   - 按 `Ctrl+Shift+P`
   - 输入 "RestfulToolkit: Refresh Endpoints"

---

### 创建项目配置文件后

1. **自动加载**：扩展激活时自动加载 `.restful-toolkit.json`
2. **重新扫描**：
   - 按 `Ctrl+Shift+P`
   - 输入 "RestfulToolkit: Refresh Endpoints"

---

## 📝 配置文件格式

### `.restful-toolkit.json` 结构

```json
{
  "scanPaths": [
    "pattern1",
    "pattern2"
  ],
  "excludePaths": [
    "pattern1",
    "pattern2"
  ],
  "maxResults": 100
}
```

### Glob 模式说明

| 模式 | 说明 | 示例 |
|------|------|------|
| `**` | 匹配任意层级目录 | `**/src/main/java` → 匹配所有 src/main/java |
| `*` | 匹配单层任意字符 | `*.java` → 匹配所有 Java 文件 |
| `**/*.java` | 匹配任意层级下的 Java 文件 | 所有目录下的 Java 文件 |

---

## ✅ 统一配置管理优势

### 之前的问题

- ❌ package.json 配置默认值
- ❌ TypeScript 代码硬编码 fallback 值
- ❌ 两处配置不一致导致问题
- ❌ 修改一处需要同时修改多处

### 现在的优势

- ✅ **单点维护**：所有默认配置在 `src/config/ScanConfig.ts`
- ✅ **自动同步**：package.json 和代码引用同一配置源
- ✅ **灵活配置**：支持 VS Code settings + 项目配置文件
- ✅ **团队共享**：项目配置文件可提交 Git

---

## 🚀 快速开始

### 使用默认配置（无需配置）

1. ✅ 打开任意 Java/Kotlin 项目
2. ✅ 自动扫描（单模块和多模块都支持）
3. ✅ 按 `Ctrl+Alt+N` 搜索端点

---

### 自定义配置

1. 按 `Ctrl+Shift+P`
2. 输入 "**RestfulToolkit: Create Project Config File**"
3. 编辑 `.restful-toolkit.json`
4. 按 `Ctrl+Shift+P` → "RestfulToolkit: Refresh Endpoints"

---

## 📖 配置示例

### 最小配置（使用默认值）

**不需要任何配置文件！** 默认配置已支持大部分项目。

---

### 团队共享配置

```json
{
  "scanPaths": [
    "**/src/main/java/**/*.java"
  ],
  "excludePaths": [
    "**/src/test/**",
    "**/target/**"
  ],
  "maxResults": 50
}
```

提交到 Git，团队成员共享同一配置。

---

### 大型项目优化配置

```json
{
  "scanPaths": [
    "module-core/src/main/java/**/*.java",
    "module-api/src/main/java/**/*.java"
  ],
  "excludePaths": [
    "**/target/**",
    "**/build/**",
    "**/generated/**"
  ],
  "maxResults": 200
}
```

只扫描核心模块，提高扫描速度。

---

## 🔍 配置调试

### 查看当前生效配置

**打开输出通道**：
1. 按 `Ctrl+Shift+P`
2. 输入 "View: Toggle Output"
3. 选择 "**RestfulToolkit**"

**查看日志**：
```
[INFO] Loaded project config from .restful-toolkit.json
[INFO] Effective scan config: scanPaths=["**/src/main/java/**/*.java"]
[INFO] Starting workspace scan with patterns: **/src/main/java/**/*.java
```

---

## ⚠️ 注意事项

### 配置冲突

**如果同时配置**：
- VS Code settings
- 项目配置文件 `.restful-toolkit.json`

**优先级**：VS Code settings > 项目配置文件 > 默认配置

---

### 配置文件位置

**必须在项目根目录**：
```bash
project-root/
├── .restful-toolkit.json  ✅ 正确位置
├── src/
└── pom.xml

project-root/submodule/
└── .restful-toolkit.json  ❌ 错误位置（不会被加载）
```

---

## 📚 相关文档

- [README.md](../readme.md) - 扩展使用指南
- [CHANGELOG.md](../changelog.md) - 版本更新历史
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - 测试指南

---

**配置系统让你完全掌控扫描行为！** 🎯