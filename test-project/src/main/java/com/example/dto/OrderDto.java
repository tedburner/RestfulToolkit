package com.example.dto;

/**
 * 嵌套 DTO 测试 — 订单包含用户和地址
 */
public class OrderDto {
    private Long orderId;
    private String orderNo;
    private UserDto user;
    private AddressDto shippingAddress;
    private Double totalAmount;
}
