# 解决 "window is not defined" 错误的步骤

## 问题原因

VS Code 扩展运行在 Node.js 环境中，不是浏览器环境，因此不能使用浏览器的 `window` 对象。

这个错误可能来自：
1. Webpack 配置问题
2. 某些依赖包的环境检测
3. VS Code 扩展主机初始化问题

## 已完成的修复

✅ 1. 清理并重新安装依赖
✅ 2. 优化 Webpack 配置
✅ 3. 重新构建扩展 (extension.js = 21KB)
✅ 4. 更新 .vscodeignore 配置

## 现在尝试启动调试

### 步骤 1: 重新加载 VS Code

在当前 VS Code 窗口：
1. 按 `Ctrl+Shift+P`
2. 输入：**"Developer: Reload Window"**
3. 按 Enter

### 步骤 2: 清除 VS Code 扩展缓存

```bash
# Windows
rm -rf $HOME/.vscode/extensions/development

# 或者在 VS Code 中按 Ctrl+Shift+P，输入：
# "Developer: Clean Extension Development Host"
```

### 步骤 3: 启动调试

重新加载后，按 **F5** 启动调试。

## 如果仍然出现错误

### 方案 A: 使用打包安装方式

这是最可靠的方法：

```bash
# 1. 安装打包工具
npm install -g @vscode/vsce

# 2. 打包扩展
vsce package

# 这会生成文件：restful-toolkit-1.0.0.vsix

# 3. 安装扩展
code --install-extension restful-toolkit-1.0.0.vsix

# 4. 重启 VS Code
# 扩展会自动激活
```

安装后测试：
1. 打开 `test-project` 目录
2. 按 `Ctrl+Alt+N` 测试搜索
3. 应看到 26 个端点

### 方案 B: 检查依赖问题

如果某些依赖包有问题，可能需要添加 Node.js polyfill：

```bash
# 检查是否有依赖使用了 window
npm list --depth=0
```

### 方案 C: 最小化测试

创建最小化的扩展配置测试：

1. 检查 package.json 的 activationEvents 是否正确
2. 确保 main 字段指向正确的文件：`"./dist/extension.js"`
3. 检查 engines.vscode 版本是否匹配

## 验证扩展加载

在扩展开发主机窗口中（如果成功启动）：

### 检查输出通道
1. 按 `Ctrl+Shift+P`
2. 输入 "View: Toggle Output"
3. 选择 "**RestfulToolkit**" 通道
4. 查看是否有激活日志

### 检查开发者控制台
1. 按 `Ctrl+Shift+I` 打开开发者工具
2. 查看 Console 标签页
3. 应看到：
   ```
   RestfulToolkit extension is now active!
   ```

### 检查扩展列表
1. 按 `Ctrl+Shift+X`
2. 在已安装扩展中找到 RestfulToolkit
3. 应显示为启用状态

## 常见错误和解决方案

### 错误 1: "Extension Host crashed"

**原因**: 扩展代码有致命错误

**解决**:
- 检查 extension.ts 的 activate 函数
- 查看开发者控制台的错误堆栈
- 确保所有 import 正确

### 错误 2: "Cannot find module"

**原因**: 构建不完整或路径错误

**解决**:
```bash
# 完整重新构建
rm -rf dist
npm run build

# 检查产物
ls -lh dist/extension.js
```

### 错误 3: "window is not defined" (仍然出现)

**可能原因**:
- 某个依赖包检查了环境
- Webpack 模块系统问题

**临时解决**: 使用打包安装方式（方案 A）

## 当前构建状态

✅ **构建成功**：
- extension.js: 21 KB
- 所有模块正确打包
- vscode 模块已外部化
- Source map 已生成

## 下一步操作

**推荐使用打包安装方式**：

```bash
# 1. 打包
vsce package

# 2. 安装
code --install-extension restful-toolkit-1.0.0.vsix

# 3. 重启 VS Code 并测试
```

这是最稳定可靠的方法，可以避免扩展开发主机的各种环境问题。

---

如果还有问题，请告诉我具体的错误信息，我会继续帮你排查！