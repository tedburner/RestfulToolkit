package com.example.controller;

import javax.ws.rs.*;
import java.util.List;

/**
 * 综合测试 JAX-RS Resource
 *
 * 覆盖：
 * - 基础 CRUD（GET/POST/PUT/DELETE）
 * - @PathParam, @QueryParam, @FormParam
 * - 多参数组合
 * - 无参数
 */
@Path("/api/test")
public class TestResource {

    @GET
    public List<String> listOrders() {
        return List.of("order1", "order2");
    }

    @GET
    @Path("/{id}")
    public String getOrderById(@PathParam("id") Long id) {
        return "Order: " + id;
    }

    @POST
    @Path("/create")
    public String createOrder() {
        return "Created";
    }

    @PUT
    @Path("/{id}")
    public String updateOrder(@PathParam("id") Long id) {
        return "Updated: " + id;
    }

    @DELETE
    @Path("/{id}")
    public String deleteOrder(@PathParam("id") Long id) {
        return "Deleted: " + id;
    }

    @GET
    @Path("/status/{status}")
    public String getByStatus(@PathParam("status") String status) {
        return "Status: " + status;
    }

    @GET
    @Path("/search")
    public String search(@QueryParam("keyword") String keyword) {
        return "Search: " + keyword;
    }

    @POST
    @Path("/submit")
    public String submit(
            @FormParam("username") String username,
            @FormParam("email") String email) {
        return "Submitted: " + username;
    }

    @PUT
    @Path("/{id}/update")
    public String updateWithNotify(
            @PathParam("id") Long id,
            @QueryParam("notify") boolean notify) {
        return "Updated: " + id;
    }

    @GET
    @Path("/health")
    public String health() {
        return "OK";
    }

    @GET
    @Path("/auth")
    public String auth(
            @HeaderParam("Authorization") String token,
            @HeaderParam("X-Correlation-Id") String correlationId) {
        return "Auth: " + token;
    }
}
