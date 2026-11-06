package com.example.sample.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class UserDto {
    private Long id;
    private String name;

    @JsonProperty("email_address")
    private String emailAddress;

    private AddressDto address;
    private List<String> tags;
    private List<AddressDto> previousAddresses;
}
