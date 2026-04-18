package com.example.controller;

import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    @GetMapping
    public List<String> getAllProducts() {
        return List.of("产品1", "产品2", "产品3");
    }

    @GetMapping("/{id}")
    public String getProductById(@PathVariable Long id) {
        return "产品ID: " + id;
    }

    @PostMapping
    public String createProduct() {
        return "创建产品成功";
    }

    @PutMapping("/{id}")
    public String updateProduct(@PathVariable Long id) {
        return "更新产品ID: " + id;
    }

    @DeleteMapping("/{id}")
    public String deleteProduct(@PathVariable Long id) {
        return "删除产品ID: " + id;
    }

    @GetMapping("/category/{category}")
    public String getProductsByCategory(@PathVariable String category) {
        return "分类: " + category;
    }
}