package com.example.controller;

import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 测试类级别 RequestMapping 结尾带斜杠的情况
 */
@RestController
@RequestMapping("/api/categories/")
public class CategoryController {

    @GetMapping
    public List<String> getAllCategories() {
        return List.of("分类1", "分类2", "分类3");
    }

    @GetMapping("/{id}")
    public String getCategoryById(@PathVariable Long id) {
        return "分类ID: " + id;
    }

    @GetMapping("/test/")
    public String testEndpoint() {
        return "测试端点 - 结尾带斜杠";
    }

    @GetMapping("test_line/")
    public String testEndpoint() {
        return "测试端点 - 结尾带斜杠";
    }

    @GetMapping("/nested/{categoryId}/products")
    public String getProductsByCategory(@PathVariable Long categoryId) {
        return "分类 " + categoryId + " 的产品列表";
    }

    @PostMapping
    public String createCategory() {
        return "创建分类成功";
    }

    @PutMapping("/{id}")
    public String updateCategory(@PathVariable Long id) {
        return "更新分类ID: " + id;
    }

    @DeleteMapping("/{id}")
    public String deleteCategory(@PathVariable Long id) {
        return "删除分类ID: " + id;
    }
}