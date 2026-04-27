# RestfulToolkit

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.0.3-green.svg)](https://github.com/tedburner/RestfulToolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**English Documentation** | **[中文文档](README_CN.md)**

A VS Code extension for searching and navigating RESTful API endpoints in Java/Kotlin Spring and JAX-RS projects.

## Features

- 🔍 **Quick Search**: Fast fuzzy search for REST endpoints by path, class name, method name, or HTTP method
- 🎯 **Instant Navigation**: Jump directly to the controller method definition with a single click
- 🚀 **Real-time Updates**: Automatically scans and updates endpoint cache when files change
- 🎨 **Visual Indicators**: Color-coded HTTP method icons (GET, POST, PUT, DELETE, PATCH)
- ⚙️ **Configurable**: Customizable scan paths and exclusion patterns
- 🔄 **Manual Refresh**: Force re-scan on demand
- 📋 **Copy Parameters**: Right-click context menu to copy endpoint parameters in URL Params, JSON Body, Form Data, or x-www-form-urlencoded format
- 🔀 **Naming Transform**: Auto-detect or toggle between camelCase and snake_case
- 📦 **DTO Expansion**: Nested DTO field resolution up to 3 levels deep

## Supported Frameworks

### Spring MVC / Spring Boot
- `@RequestMapping` (class and method level)
- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
- `@RequestMapping` with `method` parameter
- Multi-path annotations: `@GetMapping({"/users", "/list"})`

### JAX-RS
- `@Path` (class and method level)
- `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`

### Supported File Types
- Java (`*.java`)
- Kotlin (`*.kt`)

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "RestfulToolkit"
4. Click Install

### From Source
1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 in VS Code to launch extension development host

## Usage

### Search Endpoints

Use keyboard shortcuts:
- **Windows/Linux**: `Ctrl+Alt+N` or `Ctrl+\`
- **Mac**: `Cmd+Alt+N` or `Cmd+\`

Or via Command Palette:
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "RestfulToolkit: Search REST Endpoints"
3. Select an endpoint from the search results
4. The file opens and jumps to the method definition

### Refresh Endpoints

To manually refresh the endpoint cache:
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "RestfulToolkit: Refresh Endpoints"
3. Wait for the scan to complete

## Configuration

RestfulToolkit supports two levels of configuration:

### 🌐 Global/Workspace Settings (VS Code Settings)

Configure in VS Code settings (`Ctrl+,` / `Cmd+,`):

```json
{
  "restfulToolkit.scanPaths": [
    "**/src/main/java/**/*.java",
    "**/src/main/kotlin/**/*.kt"
  ],
  "restfulToolkit.excludePaths": [
    "**/src/test/**",
    "**/target/**",
    "**/build/**",
    "**/.gradle/**",
    "**/node_modules/**"
  ],
  "restfulToolkit.maxResults": 100
}
```

### 📁 Project-level Configuration (Recommended)

Create `.restful-toolkit.json` in your project root for per-project customization:

```json
{
  "scanPaths": [
    "**/src/main/java/**/*.java"
  ],
  "excludePaths": [
    "**/src/test/**",
    "**/target/**"
  ],
  "maxResults": 200
}
```

**Priority Order**: Project `.restful-toolkit.json` > VS Code Settings > Default Configuration

> 💡 **Tip**: Use project-level config for team sharing and multi-module projects. The file can be committed to Git for consistent configuration across team members.

### Settings Description

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `scanPaths` | `array` | `["**/src/main/java/**/*.java", "**/src/main/kotlin/**/*.kt"]` | Glob patterns for files to scan |
| `excludePaths` | `array` | `["**/src/test/**", "**/target/**", ...]` | Glob patterns to exclude from scanning |
| `maxResults` | `number` | `100` | Maximum number of search results to display |
| `copyNameFormat` | `string` | `"camelCase"` | Default name format for copied parameters (`"camelCase"` or `"snake_case"`) |

### Copy Parameters

Right-click in a controller method to copy endpoint parameters:

1. Place cursor on a REST endpoint method
2. Right-click and select "Copy Endpoint Parameters"
3. Choose the output format:
   - **URL Params**: `?param1=&param2=` — for GET/DELETE requests
   - **JSON Body**: `{"field": ""}` — for POST/PUT/PATCH with `@RequestBody`
   - **Form Data**: `field: ` line-by-line — for `@ModelAttribute`
   - **x-www-form-urlencoded**: `field1=&field2=` — URL-encoded form
4. Choose naming convention (auto-detected, or toggle camelCase/snake_case)

**Supported Annotations**:
- **Spring**: `@RequestParam`, `@PathVariable`, `@RequestBody`, `@RequestPart`, `@ModelAttribute`
- **JAX-RS**: `@PathParam`, `@QueryParam`, `@FormParam`
- **JSON**: `@JsonProperty`, `@JsonAlias`, `@JSONField`, `@JsonNaming`

**DTO Expansion**: `@RequestBody` and `@ModelAttribute` parameters automatically expand nested DTO fields (up to 3 levels deep).

## Known Limitations

The first version has the following limitations:

### 1. Inheritance Relationships
Cannot detect endpoints inherited from parent classes. If a controller extends a base class with `@RequestMapping`, only the child class's direct annotations are detected.

### 2. Dynamic Paths from Properties
Cannot resolve property placeholders like `${api.path}` in annotations.

### 3. Configuration Class Routes
Cannot detect routes configured through `@Configuration` classes (non-annotation routes).

### 4. Kotlin String Templates
Limited support for Kotlin string templates like `"${basePath}/users"` in annotation paths.

### 5. Complex Conditional Annotations
Cannot evaluate conditional annotations like `@ConditionalOnProperty` that affect endpoint availability.

**Expected Accuracy**: ~80-85% endpoint detection rate for typical Spring Boot projects.

## Troubleshooting

### No Endpoints Found
- Check that your project has Java or Kotlin files with Spring MVC or JAX-RS annotations
- Verify scan paths in settings match your project structure
- Try manual refresh: "RestfulToolkit: Refresh Endpoints"

### View Logs
- Open Command Palette
- Type "RestfulToolkit: Show Logs"
- Check the Output channel for scan details and errors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by IntelliJ IDEA's REST endpoint search functionality
- Built with VS Code Extension API
- Special thanks to the Spring and JAX-RS communities

## Roadmap

Future enhancements:
- [ ] Support for Micronaut and Quarkus frameworks
- [ ] Integration with Spring Boot Actuator runtime data
- [ ] HTTP request testing (Postman-like features)
- [ ] Services tree view
- [ ] Better support for inheritance and configuration classes

### Completed in v0.0.3
- [x] Copy endpoint parameters (JSON Body, URL Params, Form Data, x-www-form-urlencoded)
- [x] Nested DTO field expansion (up to 3 levels)
- [x] Naming convention transform (camelCase / snake_case)
- [x] i18n support (English / Chinese)

---

**Enjoy faster REST endpoint navigation!** 🚀