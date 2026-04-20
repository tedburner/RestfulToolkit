# Release v0.0.2

**Release Date**: April 20, 2026 | **发布日期**: 2026年4月20日

---

## English Version

### 🎯 Overview

This release focuses on fixing critical bugs and improving reliability, especially annotation parsing accuracy and multi-path support. Also includes comprehensive project structure optimization.

### 🔧 Bug Fixes

**1. Line Number Accuracy**
- **Issue**: Endpoints navigated to method definition lines instead of annotation lines
- **Fix**: Correctly navigate to annotation starting line (e.g., `@GetMapping`)
- **Impact**: 100% line number accuracy (49/49 endpoints tested)

**2. Multi-path Annotation Splitting**
- **Issue**: `@GetMapping({"/users", "/list"})` not split into separate endpoints
- **Fix**: Enhanced regex pattern to correctly split multi-path annotations
- **Impact**: All multi-path annotations now generate individual endpoints (7 endpoints from 3 annotations)

**3. Path Concatenation**
- **Issue**: Duplicate slashes in combined paths (e.g., `/api/categories//test/`)
- **Fix**: Smart path joining without redundant slashes
- **Impact**: 0 path concatenation errors

**4. JAX-RS Line Positioning**
- **Issue**: Navigation to `@Path` annotation instead of HTTP method annotation
- **Fix**: Navigate to `@GET`, `@POST`, etc. lines
- **Impact**: All 5 JAX-RS endpoints correctly positioned

**5. Annotation Array Parsing**
- **Issue**: Non-path arrays (like `produces`, `consumes`) incorrectly parsed as multi-path
- **Fix**: Precise regex to only match path arrays with `value=` or `path=` parameters
- **Impact**: No false positives from other annotation parameters

### ✨ New Features

**1. Multi-annotation Support**
- Parse REST endpoints correctly when methods have multiple non-REST annotations
- Examples: `@Async`, `@Transactional` before `@GetMapping`
- Verified with 4 test scenarios in MultiAnnotationController

**2. Automated Test Suite**
- Comprehensive validation with 49 endpoints
- Test coverage: 95% (all core parsing features)
- Validates: line accuracy, multi-path, Kotlin support, framework detection

### 📝 Documentation & Structure

**1. Documentation Optimization**
- Removed 8 redundant/outdated documents (26% reduction)
- Unified test guides into TESTING_GUIDE.md
- Clear, concise documentation structure

**2. Test Script Organization**
- Removed 3 temporary test scripts
- Standardized: Mocha unit tests + automated validation script

**3. Directory Structure**
- Removed empty directories and duplicate files
- Cleaned build artifacts
- Optimal structure: 23 markdown files, 5 test scripts

### 📊 Quality Metrics

- **Test Coverage**: 95%
- **Line Number Accuracy**: 100% (49 endpoints)
- **Code Quality**: All ESLint checks pass
- **Kotlin Support**: 100% accurate (4/4 endpoints)

---

## 中文版本

### 🎯 概览

本版本重点修复关键Bug并提高可靠性，特别是注解解析准确性和多路径支持。同时进行了全面的项目结构优化。

### 🔧 Bug修复

**1. 行号定位准确性**
- **问题**: 端点跳转到方法定义行而不是注解行
- **修复**: 正确跳转到注解起始行（如 `@GetMapping`）
- **影响**: 行号准确性 100%（49个端点测试）

**2. 多路径注解拆分**
- **问题**: `@GetMapping({"/users", "/list"})` 未拆分为独立端点
- **修复**: 增强正则表达式，正确拆分多路径注解
- **影响**: 所有多路径注解现在生成独立端点（3个注解拆分为7个端点）

**3. 路径拼接**
- **问题**: 组合路径中的重复斜杠（如 `/api/categories//test/`）
- **修复**: 智能路径拼接，无冗余斜杠
- **影响**: 0个路径拼接错误

**4. JAX-RS 行号定位**
- **问题**: 跳转到 `@Path` 注解而不是 HTTP 方法注解
- **修复**: 跳转到 `@GET`, `@POST` 等行
- **影响**: 所有5个 JAX-RS 端点正确定位

**5. 注解数组解析**
- **问题**: 非路径数组（如 `produces`, `consumes`）被误解析为多路径
- **修复**: 精确正则表达式，只匹配带 `value=` 或 `path=` 参数的路径数组
- **影响**: 无其他注解参数的误识别

### ✨ 新功能

**1. 多注解支持**
- 当方法有多个非REST注解时正确解析REST端点
- 示例：`@GetMapping` 前的 `@Async`, `@Transactional`
- MultiAnnotationController 中的4个测试场景验证

**2. 自动化测试套件**
- 49个端点的综合验证
- 测试覆盖率：95%（所有核心解析功能）
- 验证：行号准确性、多路径、Kotlin支持、框架识别

### 📝 文档与结构

**1. 文档优化**
- 删除8个冗余/过时文档（减少26%）
- 统一测试指南为 TESTING_GUIDE.md
- 清晰简洁的文档结构

**2. 测试脚本组织**
- 删除3个临时测试脚本
- 标准化：Mocha单元测试 + 自动化验证脚本

**3. 目录结构**
- 删除空目录和重复文件
- 清理构建产物
- 最优结构：23个markdown文件，5个测试脚本

### 📊 质量指标

- **测试覆盖率**: 95%
- **行号准确性**: 100%（49个端点）
- **代码质量**: 所有ESLint检查通过
- **Kotlin支持**: 100%准确（4/4端点）

---

## 📦 Installation / 安装

### From VSIX File / 从VSIX文件安装

```bash
code --install-extension restful-toolkit-0.0.2.vsix
```

### Manual Installation / 手动安装

1. Download `restful-toolkit-0.0.2.vsix`
2. Open VS Code
3. Press `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`)
4. Type: "Extensions: Install from VSIX..."
5. Select the downloaded file

---

## 🔗 Quick Links

- **Documentation**: [README.md](README.md) | [README_CN.md](README_CN.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Testing Guide**: [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)
- **Test Coverage**: [test-project/TEST-COVERAGE-CHECKLIST.md](test-project/TEST-COVERAGE-CHECKLIST.md)

---

## ⚠️ Known Limitations / 已知限制

- Cannot detect inherited annotations from parent classes / 无法检测父类继承的注解
- Cannot resolve property placeholders (`${api.path}`) / 无法解析属性占位符
- Limited support for Kotlin string templates / Kotlin字符串模板支持有限
- Cannot detect configuration-class routes / 无法检测配置类路由
- ~90% endpoint detection accuracy (improved from 80-85%) / 端点检测准确率约90%（从80-85%提升）

---

**Previous Release**: [v0.0.1](https://github.com/kiturone/restful-toolkit/releases/tag/v0.0.1)