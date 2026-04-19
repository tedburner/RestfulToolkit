package com.example.controller;

import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 测试类级别 RequestMapping 无路径，方法级别完整路径
 */
@RestController
@RequestMapping
public class HealthController {

    @GetMapping("/health")
    public String health() {
        return "健康检查通过";
    }

    @GetMapping("/ping")
    public String ping() {
        return "pong";
    }

    @GetMapping("/version")
    public String version() {
        return "v1.0.0";
    }
}