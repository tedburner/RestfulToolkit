# Spec Delta

## Purpose

Resolve Spring Boot Base URLs accurately from YAML and Properties files without port hijacking from nested configuration blocks, inline comment failures, profile mismatches, or double-slash URL concatenation.

## ADDED Requirements

### Requirement: Base URL parser isolates top-level server configuration and strips inline comments
Automatic Base URL resolution SHALL extract `server.port` and `server.servlet.context-path` / `server.context-path` only from the top-level `server` hierarchy, strip unquoted inline `#` comments in YAML/Properties values, and ignore comments on block headers.

#### Scenario: management.server.port appears before server.port in YAML
- **WHEN** `application.yml` defines `management.server.port: 9090` above top-level `server.port: 8080`
- **THEN** automatic Base URL detection resolves port `8080` rather than `9090`

#### Scenario: YAML configuration contains inline comments
- **WHEN** `application.yml` contains `server: # main web server` and `port: 8081 # HTTP port` or `context-path: /api # base path`
- **THEN** automatic Base URL detection strips the comments and resolves port `8081` and context path `/api`

### Requirement: Base URL resolution respects active Spring profiles and nearest multi-module resources
When resolving Base URL for an active controller document, the resolver SHALL honor `spring.profiles.active` declared in base/bootstrap configs when matching `application-{profile}` files exist (falling back to profile override order when `spring.profiles.active` is absent) and prefer the Spring module directory closest to the active document in multi-module workspaces.

#### Scenario: Multiple profile files exist alongside spring.profiles.active
- **WHEN** `application.yml` sets `spring.profiles.active: dev` and both `application-dev.yml` (port `8081`) and `application-prod.yml` (port `80`) exist
- **THEN** Base URL detection resolves port `8081` from `application-dev.yml` rather than alphabetically selecting `application-prod.yml`

#### Scenario: Multi-module workspace has distinct service ports per module
- **WHEN** a workspace root contains `order-service/src/main/resources/application.yml` (port `8081`) and `user-service/src/main/resources/application.yml` (port `8082`), and a copy command runs on a controller inside `order-service`
- **THEN** Base URL detection resolves port `8081` from `order-service`

### Requirement: Generated URLs and cURL commands normalize boundary slashes
URL and cURL generation SHALL join `baseUrl` (including `contextPath`) and endpoint `path` without producing duplicate slashes when `baseUrl` or `contextPath` ends with `/`, or missing slashes when `contextPath` omits a leading `/`.

#### Scenario: Configured baseUrl or context-path has a trailing slash
- **WHEN** `restfulToolkit.baseUrl` is `http://localhost:8080/` (or `server.servlet.context-path` is `/`) and the endpoint path is `/api/users`
- **THEN** `Copy Full URL` and `Copy as cURL` produce `http://localhost:8080/api/users` without `//`
