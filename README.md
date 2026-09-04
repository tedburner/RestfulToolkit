# RestfulToolkit

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.8-green.svg)](https://github.com/tedburner/RestfulToolkit)
[![Installs](https://img.shields.io/badge/installs-344-blue.svg)](https://marketplace.visualstudio.com/items?itemName=kiturone.restful-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**English** | [中文](README_CN.md)

RestfulToolkit is a VS Code extension for finding, navigating, and copying RESTful API endpoints in Java/Kotlin Spring MVC, Spring Boot, and JAX-RS projects.

It scans controller annotations, builds a searchable endpoint index, and lets you jump to source code, copy request parameters, generate full URLs/cURL commands, or create DTO classes from JSON without leaving VS Code.

## Highlights

| Capability | What it does |
|------------|--------------|
| Endpoint search | Search by URL path, class name, method name, HTTP method, camelCase acronym, or multiple words; available while background indexing runs |
| Source navigation | Jump from a QuickPick result to the exact controller annotation line |
| Parameter copy | Copy endpoint parameters as URL Params, JSON Body, Form Data, or x-www-form-urlencoded |
| DTO expansion | Expand nested request DTO fields up to 3 levels, including common JSON naming annotations |
| URL and cURL copy | Generate full URLs and cURL commands with headers, query params, and request bodies |
| Base URL detection | Read Spring configuration asynchronously through a workspace-scoped, event-invalidated in-memory cache |
| JSON to DTO | Generate Java/Kotlin DTO classes from selected JSON or clipboard JSON |
| Realtime updates | Watch Java/Kotlin files, honor workspace-relative exclusions, and atomically replace endpoints only after scan metadata remains stable |

## Supported Projects

### Frameworks

- Spring MVC / Spring Boot
- JAX-RS with `javax.ws.rs` or `jakarta.ws.rs`

### File Types

- Java: `*.java`
- Kotlin: `*.kt`

### Endpoint Annotations

| Framework | Supported annotations |
|-----------|-----------------------|
| Spring | `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping` |
| JAX-RS | `@Path`, `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH` |

Multi-path annotations such as `@GetMapping({"/users", "/list"})` are split into separate endpoints.

## Installation

Install from the VS Code Extensions view:

1. Open Extensions with `Ctrl+Shift+X`.
2. Search for `RestfulToolkit`.
3. Click Install.

From source:

```bash
git clone https://github.com/tedburner/RestfulToolkit.git
cd RestfulToolkit
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Usage

### Search Endpoints

Open the command:

- Command Palette: `RestfulToolkit: Search REST Endpoints`
- Windows/Linux: `Ctrl+Alt+N` or `Ctrl+\`
- macOS: `Cmd+Alt+N` or `Cmd+\`

Search supports:

- Path fragments: `users`
- HTTP methods: `post`
- Multiple words: `post create`
- camelCase acronyms: `dtc` for `DataTransferController`

Commands are registered before the initial scan finishes. If search opens during background indexing, QuickPick shows the endpoints discovered so far with an indexing indicator. When indexing completes, it refreshes the current query; if no endpoints were found, it closes and shows the normal empty-index warning. Initial and filtered results both respect `restfulToolkit.maxResults`.

Search keeps its existing matching and ranking behavior while processing repeated text terms only once in memory.

### Copy Endpoint Parameters

Right-click a controller method and choose `RestfulToolkit: Copy Endpoint Parameters`.

Supported parameter sources:

| Framework | Supported parameter annotations |
|-----------|---------------------------------|
| Spring | `@RequestParam`, `@PathVariable`, `@RequestBody`, `@RequestPart`, `@ModelAttribute`, `@RequestHeader` |
| JAX-RS | `@PathParam`, `@QueryParam`, `@FormParam`, `@HeaderParam` |

Output formats:

- URL Params
- JSON Body
- Form Data
- x-www-form-urlencoded

`@RequestBody` and `@ModelAttribute` DTOs are expanded when their fields can be resolved in the workspace.

### Copy Full URL

Right-click an endpoint and choose `RestfulToolkit: Copy Full URL`.

If a Spring mapping declares multiple paths, the copy commands use the first path declared in source order. Endpoint search still indexes every declared path separately.

Example output:

```text
http://localhost:8080/api/users/{id}?keyword=
```

Base URL resolution order:

1. `restfulToolkit.baseUrl` VS Code setting
2. `.restful-toolkit.json` project config
3. Spring config files such as `application.yml`, `application.properties`, `bootstrap.yml`, and profile files
4. Default `http://localhost:8080`

Detected values remain in Extension Host memory only. Creating, changing, or deleting a supported Spring configuration file invalidates the owning workspace cache.

### Copy as cURL

Right-click an endpoint and choose `RestfulToolkit: Copy as cURL`.

Example output:

```bash
curl -X POST 'http://localhost:8080/api/users' -H 'Content-Type: application/json' -d '{"name": "", "email": ""}'
```

The command includes the HTTP method, full URL, headers, and request body where applicable. The result can be imported into Postman, Bruno, or Insomnia.

### Generate DTO Class from JSON

Right-click a folder in Explorer and choose `RestfulToolkit: Generate DTO Class from JSON`.

The generator supports:

- Java and Kotlin output
- Nested objects and arrays
- `@JsonProperty` for original JSON keys
- Optional Lombok mode for Java DTOs

## Configuration

RestfulToolkit reads configuration from three levels, in priority order:

1. VS Code workspace settings
2. `.restful-toolkit.json` in the workspace root
3. Built-in defaults

| VS Code setting | Type | Default | Description |
|-----------------|------|---------|-------------|
| `restfulToolkit.scanPaths` | `array` | `["**/src/main/java/**/*.java", "**/src/main/kotlin/**/*.kt"]` | Glob patterns to scan |
| `restfulToolkit.excludePaths` | `array` | `["**/src/test/**", "**/target/**", "**/build/**", ...]` | Glob patterns to exclude; watcher matching is relative to each containing workspace folder |
| `restfulToolkit.maxResults` | `number` | `100` | Maximum search results, clamped to 1-1000 |
| `restfulToolkit.copyNameFormat` | `string` | `"camelCase"` | Default copied parameter naming style |
| `restfulToolkit.baseUrl` | `string` | `""` | Base URL for URL/cURL generation; empty means auto-detect |

Project config example:

```json
{
  "scanPaths": [
    "**/src/main/java/**/*.java",
    "**/src/main/kotlin/**/*.kt"
  ],
  "excludePaths": [
    "**/src/test/**",
    "**/target/**",
    "**/build/**"
  ],
  "maxResults": 100
}
```

## Known Limitations

- Does not detect endpoints inherited from parent classes.
- Does not resolve route placeholders such as `${api.path}`.
- Does not detect routes registered through `@Configuration` classes.
- Kotlin string template support is limited.
- Conditional annotations such as `@ConditionalOnProperty` are not evaluated.

Expected endpoint detection accuracy is about 80-85% for typical Spring Boot projects.

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| No endpoints found | Check `scanPaths`, then run `RestfulToolkit: Refresh Endpoints` and choose a full refresh |
| Generated URL has the wrong host or port | Set `restfulToolkit.baseUrl`, or check `application.yml` / `application.properties` |
| DTO fields are not expanded | Make sure the DTO class is in the workspace and imported by the controller source file |
| Search results look stale | Run `RestfulToolkit: Refresh Endpoints` |
| Need diagnostics | Open the Output panel and select the RestfulToolkit channel |

## Development

```bash
npm install
npm run compile
npm test
npm run build
```

Additional validation scripts:

```bash
node src/test/scripts/test-parameter-copy.js
node src/test/scripts/test-copy-url-curl.js
node src/test/scripts/test-all-files.js
node src/test/scripts/test-json-to-class.js
```

## Roadmap

- Micronaut and Quarkus support
- Spring Boot Actuator integration
- HTTP request execution inside VS Code
- Services tree view
- Better inheritance and configuration-class route support

## License

MIT. See [LICENSE](LICENSE).
