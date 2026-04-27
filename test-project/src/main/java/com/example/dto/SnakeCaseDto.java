package com.example.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * 测试 @JsonNaming 类级别 snake_case 策略
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SnakeCaseDto {
    private Long userId;
    private String userName;
    private String emailAddress;
    private String phoneNumber;
}
