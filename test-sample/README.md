# RestfulToolkit 本地测试样例

以本目录为 VS Code 扩展开发宿主的工作区。样例是供源码扫描的夹具，不是可独立构建或运行的 Spring/JAX-RS 应用。

- Spring Java：类级和方法级多路径、路径括号、嵌套类、请求参数、DTO 和 multipart。
- Kotlin：常用 HTTP 方法、多行注解和 DTO。
- JAX-RS：资源类及接口方法。
- `.restful-toolkit.json` 排除 `ignored` 目录；预期搜索结果为 **44 条**。`application.yml` 的预期 Base URL 是 `http://localhost:8080/sample`。
- `payloads/create-order.json` 用于验证 JSON 转 DTO 的关键字和可空类型。

在仓库根目录运行：

```sh
npm run compile
node src/test/scripts/test-sample.js
```

脚本验证解析、参数提取、DTO 展开、cURL、Base URL 和 JSON 转 DTO。脚本使用 VS Code mock，不能代替扩展宿主中的 QuickPick、剪贴板和文件监听测试。手动测试时可启动仓库的 `Run Extension` 调试配置，在扩展开发宿主中打开此目录。
