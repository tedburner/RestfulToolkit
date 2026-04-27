package com.example.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 测试 @JsonAlias 和 @JsonProperty 优先级
 */
public class AliasDto {
    // 只有 @JsonAlias，应使用 alias 作为 name
    @JsonAlias("first_name")
    private String firstName;

    // @JsonProperty 优先于 @JsonAlias
    @JsonProperty("full_name")
    @JsonAlias("name")
    private String fullName;

    // 无任何注解，使用原始名
    private Integer age;
}
