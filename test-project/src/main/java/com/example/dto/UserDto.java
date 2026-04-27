package com.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class UserDto {
    private Long id;
    private String userName;
    @JsonProperty("email_addr")
    private String email;
    private String phone;
}
