package com.example.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 测试 DTO — 注释中包含大括号、字符串和方法签名，验证注释净化不影响字段解析。
 *
 * 覆盖场景：
 * - 注释中包含 "{ }" 大括号，不应干扰类块深度计算
 * - 注释中包含 "public String fake()"，不应被误识别为方法
 * - @JsonProperty 字符串内容在 sanitize({ preserveStrings: true }) 下应保留
 * - @JsonAlias 字符串内容同样应保留
 * - 单行注释中包含引号和特殊字符
 */
public class CommentComplexDto {

    // 注释中的 "字符串" 和 { 大括号 } 不应影响解析
    @JsonProperty("user_name")
    private String userName;

    /* 块注释：public String fakeMethod(String x) { return "fake"; } */
    @JsonAlias("email_addr")
    private String emailAddress;

    // 带转义的注释：\"hello\" 以及 '单引号'
    private String phone;

    /**
     * Javadoc 注释：包含方法签名
     * public void doSomething(@RequestParam String param) {
     *     System.out.println("{not a real brace}");
     * }
     */
    @JsonProperty("is_active")
    private Boolean isActive;

    // 注释中包含 @GET @Path("/fake") 伪注解
    private Integer age;
}
