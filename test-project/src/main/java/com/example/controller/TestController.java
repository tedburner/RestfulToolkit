package com.example.controller;

import com.example.dto.AddressDto;
import com.example.dto.AliasDto;
import com.example.dto.OrderDto;
import com.example.dto.SnakeCaseDto;
import com.example.dto.UserDto;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

/**
 * 综合测试 Controller — 覆盖解析器与参数复制功能的所有场景
 *
 * 覆盖：
 * - 基础 CRUD（GET/POST/PUT/DELETE）
 * - 多路径注解（类级别 + 方法级别）
 * - 跨行注解
 * - 多注解堆叠（@Async, @Transactional）
 * - 参数注解（@RequestParam, @PathVariable, @RequestBody, @RequestPart, @ModelAttribute）
 * - 内容类型（JSON, multipart/form-data, x-www-form-urlencoded）
 * - DTO 字段展开（@JsonProperty, @JsonNaming, @JsonAlias）
 * - 尾随斜杠
 */
@RestController
@RequestMapping("/api/test")
public class TestController {

    // ========== 基础 CRUD ==========

    @GetMapping("/users")
    public List<String> listUsers() {
        return List.of("user1", "user2");
    }

    @GetMapping("/users/{id}")
    public String getUser(@PathVariable Long id) {
        return "User: " + id;
    }

    @PostMapping("/users")
    public String createUser(@RequestBody UserDto userDto) {
        return "Created: " + userDto;
    }

    @PutMapping("/users/{userId}")
    public String updateUser(@PathVariable Long userId, @RequestBody UserDto userDto) {
        return "Updated: " + userId;
    }

    @DeleteMapping("/users/{id}")
    public String deleteUser(@PathVariable Long id) {
        return "Deleted: " + id;
    }

    // ========== 多路径注解 ==========

    @GetMapping({"/items", "/products/alt"})
    public List<String> listItems() {
        return List.of("item1", "item2");
    }

    @GetMapping({"/items/{id}", "/products/{id}/alt"})
    public String getItem(@PathVariable Long id) {
        return "Item: " + id;
    }

    // ========== 跨行注解 ==========

    @GetMapping(
        value = "/multiline/data",
        produces = { "application/json", "text/plain" }
    )
    public String multilineData() {
        return "data";
    }

    @PostMapping(
        path = "/multiline/create",
        consumes = "application/json"
    )
    public String multilineCreate() {
        return "created";
    }

    // ========== 多注解堆叠 ==========

    @Async
    @PostMapping("/async/task")
    public String asyncTask() {
        return "task";
    }

    @Async
    @Transactional
    @GetMapping("/admin/status")
    public String adminStatus() {
        return "OK";
    }

    @Async
    @PutMapping("/admin/update")
    @Transactional
    public String adminUpdate() {
        return "updated";
    }

    // ========== 参数复制：URL Params ==========

    @GetMapping("/search")
    public String search(@RequestParam String keyword) {
        return "Search: " + keyword;
    }

    @GetMapping("/list")
    public String list(@RequestParam("user_name") String userName) {
        return "List: " + userName;
    }

    @GetMapping("/page")
    public String page(@RequestParam(value = "page", defaultValue = "1") int page) {
        return "Page: " + page;
    }

    @GetMapping("/user/{user_id}")
    public String getUserById(@PathVariable("user_id") Long userId) {
        return "User: " + userId;
    }

    // ========== 参数复制：JSON Body (DTO 展开) ==========

    @PostMapping("/snake")
    public String createSnake(@RequestBody SnakeCaseDto dto) {
        return "snake";
    }

    @PostMapping("/alias")
    public String createAlias(@RequestBody AliasDto dto) {
        return "alias";
    }

    // 嵌套 DTO（OrderDto → UserDto + AddressDto）
    @PostMapping("/order")
    public String createOrder(@RequestBody OrderDto order) {
        return "order";
    }

    // ========== 参数复制：multipart/form-data ==========

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam("description") String desc) {
        return "Uploaded: " + file.getOriginalFilename();
    }

    // ========== 参数复制：x-www-form-urlencoded ==========

    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public String login(
            @RequestParam("username") String username,
            @RequestParam("password") String password) {
        return "Login: " + username;
    }

    // ========== 参数复制：@ModelAttribute ==========

    @PostMapping("/form")
    public String submitForm(@ModelAttribute UserDto form) {
        return "Form: " + form;
    }

    // ========== 无参数 ==========

    @GetMapping("/health")
    public String health() {
        return "OK";
    }

    // ========== 尾随斜杠 ==========

    @GetMapping("/trailing/")
    public String trailingSlash() {
        return "trailing";
    }
}
