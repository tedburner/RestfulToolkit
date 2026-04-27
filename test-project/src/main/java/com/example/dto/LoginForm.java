package com.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class LoginForm {
    @JsonProperty("user_name")
    private String userName;
    private String password;
}
