package com.example.controller;

import com.example.dto.LoginForm;
import org.springframework.web.bind.annotation.*;

/**
 * 测试 @ModelAttribute 表单参数
 */
@RestController
@RequestMapping("/api/form")
public class FormController {

    @PostMapping("/login")
    public String login(@ModelAttribute LoginForm param) {
        return "Login: " + param;
    }
}
