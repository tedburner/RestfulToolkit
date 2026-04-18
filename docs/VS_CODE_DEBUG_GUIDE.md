# VS Code 扩展开发配置指南

## 如何在 VS Code 中加载和测试 RestfulToolkit 扩展

### 步骤 1: 打开项目

在 VS Code 中打开 RestfulToolkit 项目根目录：

```bash
cd F:\Project\person\restful-toolkit
code .
```

或使用 VS Code 文件菜单：
- File > Open Folder
- 选择 `F:\Project\person\restful-toolkit` 目录

### 步骤 2: 安装依赖（如果还未安装）

在 VS Code 终端中：

```bash
npm install
npm run compile
```

### 步骤 3: 启动扩展开发主机

**方法 1: 使用快捷键 F5**

1. 在 VS Code 中，按 **F5** 键
2. 或者点击菜单：**Run > Start Debugging**
3. 或者点击侧边栏调试图标（虫子图标），然后点击绿色启动按钮

**首次启动时会**：
- 自动运行 `npm run watch` 编译任务
- 打开一个新的 VS Code 窗口（标题显示 **[Extension Development Host]**）
- 扩展会自动加载和激活

**方法 2: 使用命令面板**

1. 按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
2. 输入 "Debug: Start Debugging"
3. 选择 "Run Extension" 配置

### 步骤 4: 验证扩展已加载

在扩展开发主机窗口中：

1. **查看状态栏**：
   - 底部状态栏应显示扩展状态（扫描进度或端点数量）

2. **打开命令面板**：
   - 按 `Ctrl+Shift+P`
   - 输入 "RestfulToolkit"
   - 应看到两个命令：
     - "RestfulToolkit: Search REST Endpoints"
     - "RestfulToolkit: Refresh Endpoints"

3. **查看扩展列表**：
   - 按 `Ctrl+Shift+X` 打开扩展视图
   - 应看到 "RestfulToolkit" 在已安装扩展中（带开发标识）

### 步骤 5: 在测试项目中验证功能

**在扩展开发主机窗口中**：

1. **打开测试项目**：
   - File > Open Folder
   - 选择 `test-project` 目录（在 RestfulToolkit 项目内）

2. **等待自动扫描**：
   - 状态栏显示 "正在扫描项目..."
   - 完成后显示 "扫描完成，共找到 26 个 REST 端点"

3. **触发搜索**：
   - 按 `Ctrl+Alt+N` 或 `Ctrl+\`
   - QuickPick 弹窗显示所有端点

4. **测试导航**：
   - 选择任意端点
   - 自动跳转到代码定义

### 如果 F5 无法启动

#### 问题 1: 没有调试配置

**症状**: 按 F5 无反应，或提示选择调试配置

**解决方案**:
- 已创建 `.vscode/launch.json` 文件
- 重新加载 VS Code 窗口：按 `Ctrl+Shift+P` → "Developer: Reload Window"
- 再次按 F5

#### 问题 2: 编译失败

**症状**: 启动调试时提示编译错误

**解决方案**:
```bash
# 手动编译
npm run compile

# 或启动监视模式
npm run watch
```

#### 问题 3: 找不到 extension.js

**症状**: 提示 "Cannot find extension.js"

**解决方案**:
```bash
# 检查 dist 目录
ls dist/extension.js

# 如果不存在，重新构建
npm run compile
```

#### 问题 4: Webpack 未构建

**症状**: extension.js 文件是空的或过小

**解决方案**:
```bash
# 使用 webpack 构建
npm run build

# 检查构建产物
ls -lh dist/extension.js
```

### 调试扩展代码

如果需要调试扩展本身的代码：

1. **设置断点**：
   - 打开 `src/extension.ts` 或其他源文件
   - 点击行号左侧设置红色断点

2. **启动调试**：
   - 按 F5 启动扩展开发主机

3. **触发断点**：
   - 在扩展开发主机窗口中执行相应操作
   - 例如：搜索端点、打开文件等
   - 断点会暂停执行，可以查看变量和调用栈

4. **调试控制**：
   - 继续 (F5)
   - 单步跳过 (F10)
   - 单步进入 (F11)
   - 单步退出 (Shift+F11)

### 停止调试

在扩展开发主机窗口中：
- 直接关闭窗口

在主窗口中：
- 点击调试工具栏的红色停止按钮
- 或按 `Shift+F5`

### 重启调试

如果修改了扩展代码：

1. **停止当前调试**：按 `Shift+F5`
2. **重新编译**：`npm run compile`（如果 watch 未运行）
3. **重新启动**：按 `F5`

或者在扩展开发主机窗口中：
- 按 `Ctrl+R` 重载窗口（更快）

### 查看扩展日志

在扩展开发主机窗口中：

1. **打开开发者工具**：
   - 按 `Ctrl+Shift+I` (Windows/Linux)
   - 或 `Cmd+Option+I` (Mac)

2. **Console 标签页**：
   - 查看 console.log 输出
   - 查看扩展激活消息

3. **Output 通道**：
   - 按 `Ctrl+Shift+P`
   - 输入 "View: Toggle Output"
   - 在下拉菜单选择 "**RestfulToolkit**"
   - 查看详细扫描和解析日志

### 打包安装（可选）

如果要像正常扩展一样安装：

```bash
# 安装打包工具
npm install -g @vscode/vsce

# 打包成 .vsix 文件
vsce package

# 生成文件：restful-toolkit-1.0.0.vsix
```

在 VS Code 中安装：

```bash
# 命令行安装
code --install-extension restful-toolkit-1.0.0.vsix

# 或在 VS Code 中：
# Extensions > Install from VSIX... > 选择 .vsix 文件
```

重启 VS Code 后，扩展会自动激活。

---

## 快速参考

### 必需的配置文件

✅ `.vscode/launch.json` - 调试配置（已创建）
✅ `.vscode/tasks.json` - 构建任务（已创建）
✅ `package.json` - 扩展清单（已存在）
✅ `tsconfig.json` - TypeScript 配置（已存在）
✅ `webpack.config.js` - 构建配置（已存在）

### 快捷键

- **F5**: 启动扩展调试
- **Ctrl+R**: 重载扩展开发主机
- **Shift+F5**: 停止调试
- **Ctrl+Alt+N**: 搜索端点（扩展中）
- **Ctrl+Shift+P**: 命令面板

### 常用命令

```bash
npm run compile    # 编译 TypeScript
npm run watch      # 监视模式编译
npm run build      # Webpack 生产构建
npm run lint       # ESLint 检查
npm test           # 运行测试
```

---

**配置完成！现在按 F5 应该可以正常启动扩展开发主机了。** 🚀