# Changelog

All notable changes to RestfulToolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-17

### Added
- Initial release of RestfulToolkit VS Code extension
- Fast fuzzy search for REST endpoints by path, class name, method name, or HTTP method
- Instant navigation to controller method definitions
- Real-time endpoint cache updates on file changes
- Color-coded HTTP method icons (GET=green, POST=blue, PUT=yellow, DELETE=red, PATCH=purple)
- Support for Spring MVC/Spring Boot annotations:
  - `@RequestMapping` (class and method level)
  - `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
  - Multi-path annotations
- Support for JAX-RS annotations:
  - `@Path` (class and method level)
  - `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`
- Support for Java and Kotlin files
- Configurable scan paths and exclusion patterns
- Manual refresh command to force re-scan
- Progress indicator during scanning
- Status bar notifications
- Logging output channel for troubleshooting

### Features
- Keyboard shortcuts:
  - Windows/Linux: `Ctrl+Alt+N` or `Ctrl+\`
  - Mac: `Cmd+Alt+N` or `Cmd+\`
- Command palette integration:
  - "RestfulToolkit: Search REST Endpoints"
  - "RestfulToolkit: Refresh Endpoints"
- VS Code settings:
  - `restfulToolkit.scanPaths`: Configure scan paths
  - `restfulToolkit.excludePaths`: Configure exclusion patterns
  - `restfulToolkit.maxResults`: Limit search results

### Known Limitations
- Cannot detect inherited annotations from parent classes
- Cannot resolve property placeholders (`${api.path}`)
- Limited support for Kotlin string templates
- Cannot detect configuration-class routes
- ~80-85% endpoint detection accuracy

### Technical Details
- Built with TypeScript and VS Code Extension API
- Uses regex-based annotation parsing
- Implements weighted fuzzy search algorithm
- Debounced file change handling
- Map-based endpoint cache with path and file indexes

## [Unreleased]

### Planned Features
- Support for Micronaut framework
- Support for Quarkus framework
- Integration with Spring Boot Actuator runtime data
- HTTP request testing capabilities
- Services tree view panel
- Enhanced inheritance support
- Configuration class route detection
- Cache persistence across sessions