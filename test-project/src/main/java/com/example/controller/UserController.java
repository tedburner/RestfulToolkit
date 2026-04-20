package com.example.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping
    public String getAllUsers() {
        return "所有用户";
    }

    @GetMapping("/{id}")
    public String getUserById(@PathVariable Long id) {
        return "用户ID: " + id;
    }

    @PostMapping
    public String createUser() {
        return "创建用户成功";
    }

    @PutMapping("/{id}")
    public String updateUser(@PathVariable Long id) {
        return "更新用户ID: " + id;
    }

    @DeleteMapping("/{id}")
    public String deleteUser(@PathVariable Long id) {
        return "删除用户ID: " + id;
    }

    @GetMapping({"/active", "/enabled"})
    public String getActiveUsers() {
        return "活跃用户";
    }

    @PostMapping("/batch")
    public String createUsersBatch() {
        return "批量创建用户";
    }
}
