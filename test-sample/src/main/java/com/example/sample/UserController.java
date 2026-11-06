package com.example.sample;

import com.example.sample.dto.UserDto;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/users", "/api/v2/users"})
public class UserController {

    // 类级两路径 × 无方法路径 → 2 个端点
    @GetMapping
    public List<UserDto> listUsers(@RequestParam(required = false) String keyword,
                                   @RequestParam(defaultValue = "1") int page) {
        return List.of();
    }

    // 类级两路径 × 单个方法路径 → 2 个端点
    @GetMapping("/{id}")
    public UserDto getUser(@PathVariable Long id) {
        return null;
    }

    // 类级两路径 × 方法多路径（2 个） → 4 个端点
    @GetMapping({"/active", "/enabled"})
    public List<UserDto> activeUsers() {
        return List.of();
    }

    // @RequestBody → JSON 正文 + DTO 展开
    @PostMapping
    public UserDto createUser(@RequestBody UserDto user) {
        return user;
    }

    @PutMapping("/{id}")
    public UserDto updateUser(@PathVariable Long id, @RequestBody UserDto user) {
        return user;
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Long id) {
    }

    // method/produces 属性 + 类级两路径 → 2 个端点
    @RequestMapping(value = "/export", method = RequestMethod.GET, produces = "application/json")
    public void export(@RequestParam String name) {
    }
}
