package com.example.controller;

import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 测试类级别 RequestMapping 带多个路径
 */
@RestController
@RequestMapping({"/api/items", "/api/products/alt"})
public class ItemController {

    @GetMapping
    public List<String> getAllItems() {
        return List.of("项目1", "项目2", "项目3");
    }

    @GetMapping("/{id}")
    public String getItemById(@PathVariable Long id) {
        return "项目ID: " + id;
    }

    @GetMapping("/{id}/details")
    public String getItemDetails(@PathVariable Long id) {
        return "项目 " + id + " 的详细信息";
    }

    @GetMapping("/{id}/variants/{variantId}")
    public String getItemVariant(
            @PathVariable Long id,
            @PathVariable Long variantId) {
        return "项目 " + id + " 的变体 " + variantId;
    }

    @GetMapping("/search")
    public String searchItems(@RequestParam String keyword) {
        return "搜索结果: " + keyword;
    }

    @GetMapping("/filter")
    public String filterItems(
            @RequestParam(value = "category", defaultValue = "all") String category,
            @RequestParam(value = "sort_by") String sortBy) {
        return "过滤: " + category;
    }

    @PostMapping
    public String createItem() {
        return "创建项目成功";
    }

    @PutMapping("/{id}")
    public String updateItem(@PathVariable Long id) {
        return "更新项目ID: " + id;
    }

    @DeleteMapping("/{id}")
    public String deleteItem(@PathVariable Long id) {
        return "删除项目ID: " + id;
    }
}