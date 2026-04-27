package com.example.controller;

import javax.ws.rs.*;

/**
 * 参数复制功能综合测试 JAX-RS Resource
 */
@Path("/api/demo")
public class ParameterDemoResource {

    // @PathParam
    @GET
    @Path("/order/{id}")
    public String getOrder(@PathParam("id") Long id) {
        return "订单ID: " + id;
    }

    // @QueryParam
    @GET
    @Path("/search")
    public String search(@QueryParam("keyword") String keyword) {
        return "搜索: " + keyword;
    }

    // @FormParam
    @POST
    @Path("/submit")
    public String submit(
            @FormParam("username") String username,
            @FormParam("email") String email) {
        return "提交: " + username;
    }

    // 多参数组合
    @PUT
    @Path("/order/{id}/update")
    public String updateOrder(
            @PathParam("id") Long id,
            @QueryParam("notify") boolean notify,
            @RequestBody OrderDto order) {
        return "更新订单: " + id;
    }

    // 无参数
    @GET
    @Path("/health")
    public String health() {
        return "OK";
    }

    // 占位 DTO
    public static class OrderDto {
        private String name;
    }
}
