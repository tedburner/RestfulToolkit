## ADDED Requirements

### Requirement: Base URL 配置
系统 SHALL 提供可配置的 `baseUrl` 设置，用于决定生成 URL 和 cURL 命令的协议、主机和端口前缀。

#### Scenario: 用户在 VS Code 设置中配置 baseUrl
- **WHEN** 用户在 VS Code 设置中设置 `"restfulToolkit.baseUrl": "https://api.example.com:443"`
- **THEN** 所有生成的 URL SHALL 使用 `https://api.example.com:443` 作为 Base

#### Scenario: 用户在项目配置中配置 baseUrl
- **WHEN** 用户在 `.restful-toolkit.json` 中设置 `"baseUrl": "http://localhost:3000"`
- **THEN** 生成的 URL SHALL 使用 `http://localhost:3000` 作为 Base

#### Scenario: 默认 Base URL 回退
- **WHEN** 任何来源均未配置 baseUrl
- **THEN** 系统 SHALL 默认使用 `http://localhost:8080`

### Requirement: Base URL 自动检测
系统 SHALL 尝试从项目的 `application.yml` 或 `application.properties` 文件中读取 `server.port` 和 `server.servlet.context-path` 来自动检测 Base URL。

#### Scenario: 检测到简单的 application.yml
- **WHEN** 项目包含 `application.yml`，其中有 `server.port: 9090`，无 context-path
- **THEN** 检测到的 Base URL SHALL 为 `http://localhost:9090`

#### Scenario: 检测到 Context Path
- **WHEN** 项目包含 `application.yml`，其中有 `server.port: 8080` 和 `server.servlet.context-path: /api/v1`
- **THEN** 检测到的 Base URL SHALL 为 `http://localhost:8080/api/v1`

#### Scenario: 占位符值跳过
- **WHEN** application.yml 中包含 `${SERVER_PORT}` 等占位符语法
- **THEN** 自动检测 SHALL 跳过该值，回退到下一优先级

### Requirement: 配置优先级
系统 SHALL 按以下优先级解析 baseUrl：VS Code 设置 > `.restful-toolkit.json` > application.yml 自动检测 > 默认值。

#### Scenario: VS Code 设置覆盖自动检测值
- **WHEN** application.yml 指定 `server.port: 9090` 且 VS Code 设置指定 `baseUrl: "http://localhost:8080"`
- **THEN** VS Code 设置 SHALL 优先，使用 `http://localhost:8080`
