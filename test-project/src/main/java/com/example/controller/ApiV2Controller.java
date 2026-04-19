package com.example.controller;

import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * 测试复杂路径和多种映射场景
 */
@RestController
@RequestMapping("/api/v2")
public class ApiV2Controller {

    // 多个路径变量
    @GetMapping("/users/{userId}/orders/{orderId}")
    public String getUserOrder(
            @PathVariable Long userId,
            @PathVariable Long orderId) {
        return "用户 " + userId + " 的订单 " + orderId;
    }

    // 多个路径变量 + 查询参数
    @GetMapping("/departments/{deptId}/employees")
    public String getDepartmentEmployees(
            @PathVariable Long deptId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page) {
        return "部门 " + deptId + " 的员工列表 (状态: " + status + ", 页码: " + page + ")";
    }

    // 正则表达式路径变量
    @GetMapping("/products/{id:\\d+}")
    public String getProductByIdNumeric(@PathVariable Long id) {
        return "产品ID (数字): " + id;
    }

    // 正则表达式路径变量 - 字符串
    @GetMapping("/products/{code:[A-Z]{3}\\d{4}}")
    public String getProductByCode(@PathVariable String code) {
        return "产品代码: " + code;
    }

    // 多个 HTTP 方法映射到同一路径
    @GetMapping("/items")
    public String getItems() {
        return "获取项目列表";
    }

    @PostMapping("/items")
    public String createItem() {
        return "创建项目";
    }

    @PutMapping("/items")
    public String updateItem() {
        return "更新项目";
    }

    // consumes 和 produces
    @PostMapping(value = "/data", consumes = "application/json", produces = "application/json")
    public String processJsonData() {
        return "处理 JSON 数据";
    }

    // headers 条件
    @GetMapping(value = "/header-test", headers = "X-Custom-Header=present")
    public String headerBasedEndpoint() {
        return "需要特定请求头的端点";
    }

    // params 条件
    @GetMapping(value = "/search", params = "type=advanced")
    public String advancedSearch() {
        return "高级搜索";
    }

    @GetMapping(value = "/search", params = "type=simple")
    public String simpleSearch() {
        return "简单搜索";
    }
}