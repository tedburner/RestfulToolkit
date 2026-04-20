package com.example.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.annotation.Transactional;

/**
 * 测试多注解场景
 * 验收点：方法上有多个注解时，是否能正确识别 REST 端点
 */
@RestController
@RequestMapping("/api/multi")
public class MultiAnnotationController {

    /**
     * 场景1：单个额外注解
     * 预期：识别为 POST /api/multi/readiness
     */
    @Async
    @PostMapping("/readiness")
    public String postData() {
        return "readiness";
    }

    /**
     * 场景2：多个额外注解
     * 预期：识别为 GET /api/multi/data
     */
    @Async
    @Transactional
    @GetMapping("/data")
    public String getData() {
        return "data";
    }

    /**
     * 场景3：REST注解在中间位置
     * 预期：识别为 PUT /api/multi/update
     */
    @Async
    @PutMapping("/update")
    @Transactional
    public String updateData() {
        return "update";
    }

    /**
     * 场景4：REST注解在最后位置
     * 预期：识别为 DELETE /api/multi/delete/{id}
     */
    @Async
    @Transactional
    @DeleteMapping("/delete/{id}")
    public String deleteData(@PathVariable Long id) {
        return "delete " + id;
    }
}