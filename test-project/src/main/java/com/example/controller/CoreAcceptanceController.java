package com.example.controller;

import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 验收测试：核心场景覆盖
 *
 * 测试点：
 * 1. 跨行注解解析和行号定位
 * 2. 多路径注解
 * 3. 各种注解格式混合使用
 */
@RestController
@RequestMapping("/acceptance")
public class CoreAcceptanceController {

    // ========== 场景1：跨行注解 ==========

    /**
     * 测试点：单参数跨行注解
     * 预期：定位到第17行（@GetMapping）
     */
    @GetMapping(
        value = "/multiline/docker"
    )
    public String docker() {
        return "Docker endpoint";
    }

    /**
     * 测试点：多参数跨行注解
     * 预期：定位到第27行（@PostMapping起始）
     */
    @PostMapping(
        path = "/multiline/create",
        consumes = "application/json"
    )
    public String create() {
        return "Created";
    }

    // ========== 场景2：多路径注解 ==========

    /**
     * 测试点：单个注解多路径（生成2个端点）
     * 预期：两个端点都定位到第41行
     */
    @GetMapping({"/multipath/list", "/multipath/all"})
    public List<String> getAll() {
        return List.of("item1", "item2");
    }

    /**
     * 测试点：跨行多路径注解（生成3个端点）
     * 预期：三个端点都定位到第50行
     */
    @PostMapping(
        {"/multipath/create", "/multipath/add", "/multipath/new"}
    )
    public String multiCreate() {
        return "Multi created";
    }

    // ========== 场景3：行号准确性验证 ==========

    // 第61行
    @GetMapping("/linetest/status")
    public String getStatus() {
        return "OK";
    }

    // 第66行
    @PostMapping("/linetest/data")
    public String postData() {
        return "Data received";
    }

    // 第71行（跨行起始）
    @PutMapping(
        value = "/linetest/update"
    )
    public String update() {
        return "Updated";
    }

    // 第78行
    @DeleteMapping("/linetest/delete/{id}")
    public String delete(@PathVariable Long id) {
        return "Deleted: " + id;
    }

    // ========== 场景4：复杂参数组合 ==========

    /**
     * 测试点：嵌套括号参数
     * 预期：能正确解析嵌套的 produces 参数
     */
    @GetMapping(
        value = "/complex/nested",
        produces = { "application/json", "text/plain" }
    )
    public String nested() {
        return "Nested parameters";
    }

    /**
     * 测试点：完整参数组合
     * 预期：能处理多个复杂参数
     */
    @RequestMapping(
        value = "/complex/full",
        method = RequestMethod.POST,
        consumes = "application/json",
        produces = "application/json"
    )
    public String fullParams() {
        return "Full parameters";
    }

    @Async
    @PostMapping("/readiness")
    public String postData() {
        return "readiness";
    }

}