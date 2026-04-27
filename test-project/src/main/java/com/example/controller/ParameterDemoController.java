package com.example.controller;

import com.example.dto.LoginForm;
import com.example.dto.UserDto;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * 参数复制功能综合测试 Controller
 */
@RestController
@RequestMapping("/api/demo")
public class ParameterDemoController {

    // @RequestParam 裸写
    @GetMapping("/search")
    public String search(@RequestParam String keyword) {
        return "搜索: " + keyword;
    }

    // @RequestParam 显式 name
    @GetMapping("/list")
    public String list(@RequestParam("user_name") String userName) {
        return "用户: " + userName;
    }

    // @RequestParam 含 defaultValue
    @GetMapping("/page")
    public String page(@RequestParam(value = "page", defaultValue = "1") int page) {
        return "页码: " + page;
    }

    // @PathVariable 裸写
    @GetMapping("/item/{id}")
    public String getItem(@PathVariable Long id) {
        return "项目ID: " + id;
    }

    // @PathVariable 显式 name
    @GetMapping("/user/{user_id}")
    public String getUser(@PathVariable("user_id") Long userId) {
        return "用户ID: " + userId;
    }

    // @RequestBody JSON
    @PostMapping("/create")
    public String create(@RequestBody UserDto userDto) {
        return "创建用户: " + userDto;
    }

    // 混合参数: @PathVariable + @RequestParam + @RequestBody
    @PutMapping("/user/{userId}/update")
    public String updateUser(
            @PathVariable Long userId,
            @RequestParam String action,
            @RequestBody UserDto userDto) {
        return "更新用户: " + userId;
    }

    // multipart/form-data
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam("description") String desc) {
        return "上传文件: " + file.getOriginalFilename();
    }

    // x-www-form-urlencoded
    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public String login(
            @RequestParam("username") String username,
            @RequestParam("password") String password) {
        return "登录: " + username;
    }

    // @ModelAttribute form
    @PostMapping("/form")
    public String submitForm(@ModelAttribute LoginForm form) {
        return "表单提交: " + form;
    }

    // 无参数
    @GetMapping("/health")
    public String health() {
        return "OK";
    }
}
