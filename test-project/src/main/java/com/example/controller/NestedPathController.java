package com.example.controller;

import org.springframework.web.bind.annotation.*;

/**
 * 测试嵌套路径和复杂 URL 结构
 */
@RestController
public class NestedPathController {

    // 三层嵌套路径
    @GetMapping("/api/v1/companies/{companyId}/departments/{deptId}/employees/{empId}")
    public String getEmployee(
            @PathVariable Long companyId,
            @PathVariable Long deptId,
            @PathVariable Long empId) {
        return "公司 " + companyId + " 部门 " + deptId + " 员工 " + empId;
    }

    // 双层嵌套 + 查询参数
    @GetMapping("/api/v1/stores/{storeId}/products")
    public String getStoreProducts(
            @PathVariable Long storeId,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return "商店 " + storeId + " 的产品 (分类: " + category +
               ", 偏移: " + offset + ", 限制: " + limit + ")";
    }

    // POST 嵌套路径
    @PostMapping("/api/v1/teams/{teamId}/members")
    public String addTeamMember(@PathVariable Long teamId) {
        return "向团队 " + teamId + " 添加成员";
    }

    // PUT 嵌套路径
    @PutMapping("/api/v1/projects/{projectId}/tasks/{taskId}")
    public String updateProjectTask(
            @PathVariable Long projectId,
            @PathVariable Long taskId) {
        return "更新项目 " + projectId + " 的任务 " + taskId;
    }

    // DELETE 嵌套路径
    @DeleteMapping("/api/v1/groups/{groupId}/users/{userId}")
    public String removeGroupUser(
            @PathVariable Long groupId,
            @PathVariable Long userId) {
        return "从组 " + groupId + " 移除用户 " + userId;
    }

    // 多个查询参数
    @GetMapping("/api/v1/search")
    public String advancedSearch(
            @RequestParam String q,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return String.format("搜索: %s (类型: %s, 排序: %s, 页: %d, 大小: %d)",
                q, type, sort, page, size);
    }
}