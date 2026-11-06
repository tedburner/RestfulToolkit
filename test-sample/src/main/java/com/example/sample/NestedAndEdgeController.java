package com.example.sample;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/edge")
public class NestedAndEdgeController {

    // 路径字符串内的括号不应破坏注解配对 → 2 个端点
    @GetMapping({"/a(b)", "/plain"})
    public String paren() {
        return "ok";
    }

    // 注解与方法声明同一行
    @GetMapping("/compact-get") public String compactGet() { return "get"; }

    @PostMapping("/compact-post") public String compactPost() { return "post"; }

    // 方法级多路径 → 3 个端点
    @PostMapping({"/create", "/add", "/new"})
    public String create() {
        return "ok";
    }

    // 嵌套类端点只归属 Inner，不归属外层类
    public static class Inner {
        @GetMapping("/inner")
        public String inner() {
            return "inner";
        }
    }

    // 无类级 @RequestMapping 的嵌套类 → 根路径挂载
    public static class RootApi {
        @GetMapping("/root")
        public String root() {
            return "root";
        }
    }
}
