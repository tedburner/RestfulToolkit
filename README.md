# RestfulToolkit

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.4-green.svg)](https://github.com/tedburner/RestfulToolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**English Documentation** | **[中文文档](README_CN.md)**

A VS Code extension for searching and navigating RESTful API endpoints in Java/Kotlin Spring and JAX-RS projects.

## Features

- 🔍 **Quick Search**: Fuzzy search for REST endpoints by path, class name, method name, or HTTP method
- 🎯 **Instant Navigation**: Jump to controller method definition with one click
- 🚀 **Real-time Updates**: Auto-scan and update endpoint cache on file change
- 🎨 **Visual Indicators**: Color-coded HTTP method icons (GET=green, POST=blue, PUT=yellow, DELETE=red, PATCH=purple)
- 📋 **Copy Parameters**: Right-click to copy endpoint parameters in URL Params, JSON Body, Form Data, or x-www-form-urlencoded format
- 🔗 **Copy Full URL**: One-click copy of complete endpoint URL (base URL + full path + query params)
- 📡 **Copy as cURL**: One-click copy of cURL command (method, URL, headers, body), directly importable to Postman/Bruno/Insomnia
- ⚙️ **Base URL Auto-detect**: Auto-detect port and context-path from `application.yml` / `application.properties`
- 🔀 **Naming Transform**: Auto-detect or toggle between camelCase and snake_case
- 📦 **DTO Expansion**: Nested DTO field resolution up to 3 levels deep
- ⚙️ **Configurable**: Customizable scan paths and exclusion patterns

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
| `maxResults` | `number` | `100` | Maximum search results |
| `copyNameFormat` | `string` | `"camelCase"` | Default name format for copied parameters |
| `baseUrl` | `string` | `""` | Base URL for generated URLs/cURL. Auto-detects from `application.yml`/`application.properties` when empty |

**Priority**: VS Code settings > `.restful-toolkit.json` in project root > defaults

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
