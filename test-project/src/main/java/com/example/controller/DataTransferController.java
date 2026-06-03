package com.example.controller;

import com.example.dto.LoginForm;
import com.example.dto.UserDto;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * 表单上传与 camelCase 搜索测试 Controller
 *
 * 覆盖场景：
 * - @ModelAttribute + @RequestPart form 参数，测试合并后的 buildFormBody
 * - 类名 DataTransferController 包含 camelCase，测试搜索 "Transfer" 匹配
 * - 方法名 uploadDocument / downloadAttachment 包含 camelCase 边界
 * - 多内容类型：form-data、x-www-form-urlencoded
 */
@RestController
@RequestMapping("/api/data-transfer")
public class DataTransferController {

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String uploadDocument(
            @RequestPart("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam(value = "tags", required = false) String tags) {
        return "Uploaded: " + title;
    }

    @PostMapping(value = "/batch-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String batchImport(
            @RequestPart("dataFile") MultipartFile dataFile,
            @RequestParam("format") String format) {
        return "Batch imported in format: " + format;
    }

    @PostMapping(value = "/profile", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public String updateProfile(
            @RequestParam("displayName") String displayName,
            @RequestParam("bio") String bio) {
        return "Updated: " + displayName;
    }

    @GetMapping("/documents/{docId}")
    public String downloadAttachment(@PathVariable Long docId) {
        return "Document: " + docId;
    }

    @DeleteMapping("/documents/{docId}")
    public String deleteDocument(@PathVariable Long docId) {
        return "Deleted: " + docId;
    }
}
