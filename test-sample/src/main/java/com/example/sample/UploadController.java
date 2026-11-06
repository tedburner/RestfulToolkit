package com.example.sample;

import com.example.sample.support.ResourceWrapper;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.List;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    // 文件类型识别：MultipartFile / List<MultipartFile> / java.io.File / Resource
    // @RequestPart 与 @RequestHeader 分别走表单与请求头
    @PostMapping(value = "/multipart", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String multipart(@RequestParam MultipartFile file,
                            @RequestParam("gallery") List<MultipartFile> gallery,
                            @RequestParam File legacyFile,
                            @RequestParam Resource avatar,
                            @RequestPart("metadata") String metadata,
                            @RequestHeader("X-Token") String token) {
        return "ok";
    }

    // 子串伪装类型：ResourceWrapper / ResourceLoader 不应被当成文件
    @PostMapping(value = "/resource-wrapper", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String wrapper(@RequestParam ResourceWrapper wrapper,
                          @RequestParam ResourceLoader loader) {
        return "ok";
    }

    // urlencoded：@RequestParam 进入正文，不再拼到 URL
    @PostMapping(value = "/form", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public String form(@RequestParam String name, @RequestParam int age) {
        return "ok";
    }
}
