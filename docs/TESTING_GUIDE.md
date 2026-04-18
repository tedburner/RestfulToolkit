# RestfulToolkit 本地测试指南

## 方法 1: VS Code 扩展开发主机（推荐）

### 步骤 1: 准备测试环境

1. **确保已安装依赖**：
```bash
npm install
npm run compile
```

2. **检查构建产物**：
```bash
ls dist/
# 应该看到 extension.js 等编译文件
```

### 步骤 2: 在 VS Code 中启动调试

1. **打开项目**：
```bash
code .
```

2. **按 F5 启动扩展开发主机**：
   - 或点击菜单：运行 > 启动调试
   - 或点击侧边栏调试图标，然后点击绿色启动按钮

3. **等待扩展主机启动**：
   - 会打开一个新的 VS Code 窗口（标题显示 "[Extension Development Host]"）
   - 扩展会自动激活

### 步骤 3: 创建测试项目

在新打开的扩展开发主机窗口中：

1. **打开一个 Java Spring 项目**：
   - 打开现有的 Spring Boot 项目
   - 或创建测试文件夹

2. **创建测试 Controller 文件**：

**UserController.java**：
```java
package com.example.demo.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class UserController {

    @GetMapping("/users")
    public String getUsers() {
        return "users";
    }

    @PostMapping("/create")
    public String createUser() {
        return "created";
    }

    @PutMapping("/update")
    public String updateUser() {
        return "updated";
    }

    @DeleteMapping("/delete")
    public String deleteUser() {
        return "deleted";
    }

    @GetMapping({"/multi1", "/multi2"})
    public String multiPath() {
        return "multi";
    }
}
```

**ProductResource.java** (JAX-RS)：
```java
package com.example.jaxrs;

import javax.ws.rs.*;

@Path("/api")
public class ProductResource {

    @GET
    @Path("/products")
    public String getProducts() {
        return "products";
    }

    @POST
    @Path("/create")
    public String createProduct() {
        return "created";
    }
}
```

### 步骤 4: 测试核心功能

#### 测试 1: 端点扫描

1. **查看状态栏**：
   - 扩展激活时会显示 "正在扫描项目..."
   - 完成后显示 "扫描完成，共找到 X 个 REST 端点"

2. **查看日志**：
   - 按 Ctrl+Shift+P 打开命令面板
   - 输入 "Output: Show Output Channels"
   - 选择 "RestfulToolkit" 输出通道
   - 查看扫描日志

#### 测试 2: 搜索端点

1. **使用快捷键触发搜索**：
   - Windows/Linux: `Ctrl+Alt+N` 或 `Ctrl+\`
   - Mac: `Cmd+Alt+N` 或 `Cmd+\`

2. **或使用命令面板**：
   - 按 Ctrl+Shift+P
   - 输入 "RestfulToolkit: Search REST Endpoints"

3. **验证搜索界面**：
   - QuickPick 弹窗应显示所有端点
   - 端点应有彩色图标（GET=🟢, POST=🔵, PUT=🟡, DELETE=🔴）
   - 显示格式：[GET] /api/users - UserController.getUsers()

4. **测试模糊搜索**：
   - 输入 "users" - 应匹配 /api/users
   - 输入 "UserController" - 应匹配所有 UserController 的端点
   - 输入 "GET" - 应匹配所有 GET 端点

#### 测试 3: 代码导航

1. **选择一个端点**：
   - 在搜索结果中选择任意端点
   - 点击或按 Enter

2. **验证跳转**：
   - 文件应打开
   - 光标定位到方法定义行
   - 方法被高亮选中

#### 测试 4: 实时更新

1. **修改 Controller**：
   - 添加新的端点方法
   - 保存文件

2. **触发搜索验证**：
   - 新端点应出现在搜索结果中

3. **删除端点**：
   - 删除一个方法
   - 保存文件
   - 验证搜索结果中已移除

#### 测试 5: 手动刷新

1. **触发刷新**：
   - 按 Ctrl+Shift+P
   - 输入 "RestfulToolkit: Refresh Endpoints"

2. **验证刷新**：
   - 状态栏显示刷新进度
   - 完成后显示新端点数量

### 步骤 5: 检查扩展日志

在扩展开发主机窗口中：

1. **打开开发者工具**：
   - 按 Ctrl+Shift+I (Windows/Linux)
   - 或 Cmd+Option+I (Mac)

2. **查看 Console**：
   - 应看到扩展激活日志
   - "RestfulToolkit extension is now active!"

3. **查看输出通道**：
   - 在输出面板选择 "RestfulToolkit"
   - 查看详细扫描日志

### 步骤 6: 测试不同场景

#### 测试 Kotlin 文件

**OrderController.kt**：
```kotlin
package com.example.kotlin

import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api")
class OrderController {

    @GetMapping("/orders")
    fun getOrders(): String {
        return "orders"
    }

    @PostMapping("/create")
    fun createOrder(): String {
        return "created"
    }
}
```

#### 测试路径变量

```java
@GetMapping("/users/{id}")
public User getUserById(@PathVariable Long id) {
    // ...
}
```

#### 测试多路径

```java
@GetMapping({"/list", "/all"})
public List<User> listUsers() {
    // ...
}
```

### 步骤 7: 调试扩展代码

如果需要调试扩展本身：

1. **在源代码中设置断点**：
   - 打开 src/extension.ts
   - 点击行号左侧设置断点

2. **重新启动调试**：
   - 在扩展开发主机中按 Ctrl+R 重载
   - 或在原窗口停止调试，重新按 F5

3. **触发断点**：
   - 执行相应操作（如搜索、扫描）
   - 断点会暂停执行
   - 可以查看变量、调用栈等

---

## 方法 2: 打包安装测试

### 步骤 1: 安装 vsce 工具

```bash
npm install -g @vscode/vsce
```

### 步骤 2: 打包扩展

```bash
vsce package
```

这会生成 `.vsix` 文件，如：`restful-toolkit-1.0.0.vsix`

### 步骤 3: 安装扩展

1. **在 VS Code 中安装**：
   - 打开 VS Code
   - 按 Ctrl+Shift+P
   - 输入 "Extensions: Install from VSIX..."
   - 选择生成的 .vsix 文件

2. **或使用命令行安装**：
```bash
code --install-extension restful-toolkit-1.0.0.vsix
```

### 步骤 4: 测试安装的扩展

重启 VS Code，然后按照方法 1 的测试步骤测试。

---

## 测试检查清单

### ✅ 基础功能测试
- [ ] 扩展激活成功
- [ ] 文件扫描正常
- [ ] 状态栏显示扫描进度
- [ ] 日志输出正确

### ✅ 搜索功能测试
- [ ] 快捷键触发搜索
- [ ] 命令面板触发搜索
- [ ] QuickPick UI 显示正常
- [ ] HTTP 方法图标显示正确
- [ ] 模糊搜索工作正常
- [ ] 搜索结果排序合理

### ✅ 导航功能测试
- [ ] 选择端点跳转到文件
- [ ] 定位到正确行号
- [ ] 方法被高亮选中
- [ ] 处理已打开文件

### ✅ 实时更新测试
- [ ] 文件创建时扫描新端点
- [ ] 文件修改时更新端点
- [ ] 文件删除时移除端点
- [ ] 手动刷新功能正常

### ✅ 边缘场景测试
- [ ] Kotlin 文件支持
- [ ] 路径变量解析
- [ ] 多路径注解
- [ ] 无端点的项目
- [ ] 大型项目性能

---

## 已知问题和解决方案

### 问题 1: 扩展未激活

**症状**: 扩展不工作，命令面板找不到 RestfulToolkit 命令

**解决方案**:
1. 检查 package.json 的 activationEvents
2. 确保打开了 Java 或 Kotlin 文件
3. 按 Ctrl+Shift+P 输入 "Developer: Reload Window"

### 问题 2: 扫描未找到端点

**症状**: 状态栏显示 "未找到文件" 或端点数为 0

**解决方案**:
1. 检查文件是否在正确路径 (src/main/java 或 src/main/kotlin)
2. 检查注解格式是否正确
3. 查看输出通道的错误日志
4. 尝试手动刷新

### 问题 3: 搜索结果不完整

**症状**: 某些端点未出现在搜索结果中

**解决方案**:
1. 查看日志确认端点是否被扫描
2. 检查注解格式是否符合规范
3. 验证文件路径是否在扫描范围内
4. 尝试手动刷新

### 问题 4: 跳转位置不准确

**症状**: 跳转到的行号不是方法定义行

**解决方案**:
1. 这是已知限制 - 注解可能跨多行导致行号偏差
2. 检查方法定义前是否有空行或注释
3. 后续版本会改进行号精确度

---

## 测试完成后

### 清理测试环境

如果使用扩展开发主机：
- 直接关闭扩展开发主机窗口即可

如果安装了 .vsix：
```bash
# 卸载扩展
code --uninstall-extension restful-toolkit-1.0.0.vsix
```

### 提交反馈

发现问题或有改进建议：
1. 查看 GitHub Issues
2. 创建新 Issue 描述问题
3. 附上日志和测试场景

---

**测试愉快！** 🚀