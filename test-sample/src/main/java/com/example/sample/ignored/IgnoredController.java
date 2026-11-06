package com.example.sample.ignored;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ignored")
public class IgnoredController {

    // 该目录被 .restful-toolkit.json 的 excludePaths 排除，不应出现在索引中
    @GetMapping("/never")
    public String never() {
        return "should be excluded";
    }
}
