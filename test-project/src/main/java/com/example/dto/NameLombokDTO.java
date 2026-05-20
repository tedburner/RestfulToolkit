package com.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Data;

@Data
public class NameLombokDTO {

    @JsonProperty("name")
    private String name;

    @JsonProperty("age")
    private Long age;

    @JsonProperty("email")
    private String email;

    @JsonProperty("isActive")
    private Boolean isActive;

    @JsonProperty("balance")
    private Double balance;

    @JsonProperty("tags")
    private List<String> tags;

    @JsonProperty("address")
    private Address address;

    @JsonProperty("contact")
    private Contact contact;

    @JsonProperty("roles")
    private List<Roles> roles;

    @JsonProperty("metadata")
    private Metadata metadata;

    @Data
    public static class Address {

        @JsonProperty("street")
        private String street;

        @JsonProperty("city")
        private String city;

        @JsonProperty("zipCode")
        private String zipCode;

        @JsonProperty("country")
        private String country;

    }

    @Data
    public static class Contact {

        @JsonProperty("phone")
        private String phone;

        @JsonProperty("wechat")
        private String wechat;

        @JsonProperty("emergencyContact")
        private EmergencyContact emergencyContact;

        @Data
        public static class EmergencyContact {

            @JsonProperty("name")
            private String name;

            @JsonProperty("relation")
            private String relation;

            @JsonProperty("phone")
            private String phone;

        }

    }

    @Data
    public static class Roles {

        @JsonProperty("id")
        private Long id;

        @JsonProperty("roleName")
        private String roleName;

        @JsonProperty("permissions")
        private List<String> permissions;

    }

    @Data
    public static class Metadata {

        @JsonProperty("createdAt")
        private String createdAt;

        @JsonProperty("updatedAt")
        private String updatedAt;

        @JsonProperty("createdBy")
        private String createdBy;

    }

}