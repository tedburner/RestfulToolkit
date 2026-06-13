# RestfulToolkit

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.6-green.svg)](https://github.com/tedburner/RestfulToolkit)
[![Downloads](https://img.shields.io/badge/downloads-164-blue.svg)](https://marketplace.visualstudio.com/items?itemName=kiturone.restful-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**English Documentation** | **[中文文档](README_CN.md)**

A VS Code extension for searching and navigating RESTful API endpoints in Java/Kotlin Spring and JAX-RS projects.

## Why RestfulToolkit?

In medium-to-large Spring Boot or JAX-RS projects, finding API endpoints is a daily pain:

- **No unified entry point**: Routes are scattered across dozens of `@RestController` classes and methods — you have to manually search files or grep annotations.
- **No quick overview**: There is no built-in way to see "what endpoints does this project expose" at a glance.
- **API testing setup is tedious**: Writing request bodies, form data, or cURL commands by hand from controller annotations wastes time.

RestfulToolkit solves this by scanning all `@RequestMapping` / `@Path` annotations in your project, indexing them into a searchable database, and letting you jump, copy, or test endpoints from a single quick-pick panel — **zero configuration required**.

## Who is it for?

- **Java / Kotlin backend developers** working on Spring MVC, Spring Boot, or JAX-RS projects
- **QA / API testers** who need to quickly find endpoints and generate cURL / JSON payloads for testing
- **Code reviewers** who want to audit all exposed API routes without opening every controller file

## Core Features

### 🔍 One-Panel Endpoint Search

Fuzzy search by URL path, class name, method name, or HTTP method. Click to jump directly to the controller method — no more Ctrl+Shift+F grepping.

### 📋 Smart Parameter Copy

Right-click any endpoint → copy its parameters as **URL Params**, **JSON Body**, **Form Data**, or **x-www-form-urlencoded**. Nested DTO fields are auto-expanded up to 3 levels deep, with camelCase / snake_case auto-detection.

### 📡 One-Click cURL Generation

Generate a ready-to-use cURL command (HTTP method + URL + headers + body with DTO expansion) that can be directly imported into Postman, Bruno, or Insomnia.

### ⚡ Zero Config, Real-Time Sync

Auto-detects `application.yml` / `application.properties` for base URL. Watches file changes and updates the endpoint cache in real time. Works out of the box — just install and search.

### Full Feature List

| Feature | Description |
|---------|-------------|
| Quick Search | Fuzzy search by path, class, method, or HTTP method |
| Instant Navigation | Jump to controller definition with one click |
| Real-time Updates | Auto-scan and update cache on file change |
| Visual Indicators | Color-coded HTTP method icons |
| Copy Parameters | URL Params / JSON Body / Form Data / x-www-form-urlencoded |
| Copy Full URL | Base URL + path + query params |
| Copy as cURL | Method + URL + headers + body, Postman-importable |
| Base URL Auto-detect | Port and context-path from application.yml / properties, resolved per workspace folder |
| Naming Transform | camelCase / snake_case auto-detect |
| DTO Expansion | Nested DTO field resolution up to 3 levels |
| JSON to DTO | Generate Java/Kotlin DTO classes from selected or clipboard JSON |
| Configurable | Custom scan paths and exclusion patterns |

## Supported Frameworks

### Spring MVC / Spring Boot
- `@RequestMapping` (class and method level)
- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
- Multi-path annotations: `@GetMapping({"/users", "/list"})`

### JAX-RS
- `@Path` (class and method level)
- `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`

### Supported File Types
- Java (`*.java`), Kotlin (`*.kt`)

## Installation

Search "RestfulToolkit" in VS Code Extensions view (Ctrl+Shift+X) and click Install.

**From source**: `git clone` → `npm install` → `npm run compile` → press F5 in VS Code.

## Usage

### Search Endpoints

Keyboard shortcuts:
- **Windows/Linux**: `Ctrl+Alt+N` or `Ctrl+\`
- **Mac**: `Cmd+Alt+N` or `Cmd+\`

Or Command Palette: "RestfulToolkit: Search REST Endpoints"

### Refresh Endpoints

Command Palette: "RestfulToolkit: Refresh Endpoints"

## Configuration

RestfulToolkit supports three configuration levels:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `scanPaths` | `array` | `["**/src/main/java/**/*.java", "**/src/main/kotlin/**/*.kt"]` | Glob patterns for files to scan |
| `excludePaths` | `array` | `["**/src/test/**", "**/target/**", ...]` | Glob patterns to exclude |
| `maxResults` | `number` | `100` | Maximum search results (1-1000) |
| `copyNameFormat` | `string` | `"camelCase"` | Default name format for copied parameters |
| `baseUrl` | `string` | `""` | Base URL for generated URLs/cURL. Auto-detects from `application.yml`/`application.properties` when empty |

**Priority**: VS Code settings > `.restful-toolkit.json` in each workspace root > defaults

## Copy Commands

### Copy Parameters

Right-click on a controller method → "Copy Endpoint Parameters":
1. Choose format: URL Params / JSON Body / Form Data / x-www-form-urlencoded
2. Choose naming: camelCase / snake_case (auto-detected)

**Supported annotations**:
- **Spring**: `@RequestParam`, `@PathVariable`, `@RequestBody`, `@RequestPart`, `@ModelAttribute`, `@RequestHeader`
- **JAX-RS**: `@PathParam`, `@QueryParam`, `@FormParam`, `@HeaderParam`
- `@RequestBody` and `@ModelAttribute` parameters auto-expand nested DTO fields (up to 3 levels).

### Copy Full URL

Output: `http://localhost:8080/api/users/{id}?keyword=`
- Base URL resolved from: VS Code settings → `application.yml`/`application.properties` → default `http://localhost:8080`
- Path parameters remain as `{placeholders}`

### Copy as cURL

Includes: HTTP method, full URL, headers (`@RequestHeader`/`@HeaderParam`), and request body with DTO expansion.
Directly importable into Postman, Bruno, and Insomnia.

Example: `curl -X POST 'http://localhost:8080/api/users' -H 'Content-Type: application/json' -d '{"name": "", "email": ""}'`

## Known Limitations

- Cannot detect inherited annotations from parent classes
- Cannot resolve property placeholders (`${api.path}`)
- Cannot detect `@Configuration` class routes
- Limited Kotlin string template support
- Cannot evaluate conditional annotations (`@ConditionalOnProperty`)

**Expected accuracy**: ~80-85% endpoint detection rate for typical Spring Boot projects.

## Troubleshooting

- **No endpoints found**: Verify scan paths match your project structure, then run "RestfulToolkit: Refresh Endpoints"
- **View logs**: Command Palette → "RestfulToolkit: Show Logs" → check Output channel

## Roadmap

- Support for Micronaut and Quarkus frameworks
- Spring Boot Actuator integration
- HTTP request testing capabilities
- Services tree view panel
- Better inheritance and configuration class support

## License

MIT — see [LICENSE](LICENSE).

**Enjoy faster REST endpoint navigation!**
