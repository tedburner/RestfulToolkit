## 1. 类型定义与配置扩展

- [ ] 1.1 在 `types.ts` 中扩展 `EndpointParameter.source`，新增 `'header'` 类型
- [ ] 1.2 在 `ScanConfig.ts` 中新增 `baseUrl` 配置字段和 `CONFIG_KEYS.baseUrl`
- [ ] 1.3 在 `ConfigManager.ts` 中新增 `getBaseUrl()` 方法，实现配置回退链
- [ ] 1.4 在 `package.json` 中新增 `restfulToolkit.baseUrl` 配置属性

## 2. Base URL 自动检测

- [ ] 2.1 新建 `BaseUrlResolver.ts`，实现从 `application.yml` / `application.properties` 读取 `server.port` 和 `server.servlet.context-path`
- [ ] 2.2 在 `ConfigManager.getBaseUrl()` 中集成自动检测逻辑

## 3. 类级路径拼接

- [ ] 3.1 修改 `ParameterExtractor.findMethodAtPosition`，向前搜索类级 `@RequestMapping` / `@Path` 注解
- [ ] 3.2 实现类级路径 + 方法级路径拼接逻辑，去除重复斜杠
- [ ] 3.3 修改 `ParameterExtractor.extractPathFromAnnotations` 支持多路径提取

## 4. 请求头参数解析

- [ ] 4.1 在 `SpringParameterParser` 注解列表新增 `RequestHeader`，映射 source 为 `header`
- [ ] 4.2 在 `JaxRsParameterParser` 中将 `HeaderParam` 的 source 从 `query` 改为 `header`

## 5. URL 生成命令

- [ ] 5.1 新建 `UrlGenerator.ts`：接收 `EndpointCopyInfo` + Base URL，生成完整 URL
- [ ] 5.2 新建 `CopyUrlCommand.ts`：右键菜单命令，提取端点信息 → 生成 URL → 写入剪贴板
- [ ] 5.3 在 `extension.ts` 中注册 `restfulToolkit.copyUrl` 命令
- [ ] 5.4 在 `package.json` menus 中添加右键菜单入口

## 6. cURL 生成命令

- [ ] 6.1 新建 `CurlConverter.ts`：接收 `EndpointCopyInfo` + Base URL，生成 cURL 命令字符串
- [ ] 6.2 新建 `CopyCurlCommand.ts`：右键菜单命令，提取端点信息 → 生成 cURL → 写入剪贴板
- [ ] 6.3 在 `extension.ts` 中注册 `restfulToolkit.copyCurl` 命令
- [ ] 6.4 在 `package.json` menus 中添加右键菜单入口

## 7. 国际化标签

- [ ] 7.1 在 `i18n.ts` 中新增 Copy Full URL 和 Copy as cURL 相关标签（成功提示、错误提示）

## 8. 测试与验证

- [ ] 8.1 编写 `CurlConverter` 单元测试（GET/POST/Form/Urlencoded 场景）
- [ ] 8.2 编写 `BaseUrlResolver` 单元测试（yml 解析、properties 解析、占位符跳过）
- [ ] 8.3 编写 `ParameterExtractor` 类级路径拼接测试
- [ ] 8.4 编写 `CopyUrlCommand` 和 `CopyCurlCommand` 集成测试
