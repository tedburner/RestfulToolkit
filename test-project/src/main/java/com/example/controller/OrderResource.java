package com.example.controller;

import javax.ws.rs.*;
import java.util.List;

@Path("/api/orders")
public class OrderResource {

    @GET
    public List<String> getAllOrders() {
        return List.of("订单1", "订单2", "订单3");
    }

    @GET
    @Path("/{id}")
    public String getOrderById(@PathParam("id") Long id) {
        return "订单ID: " + id;
    }

    @POST
    @Path("/create")
    public String createOrder() {
        return "创建订单成功";
    }

    @PUT
    @Path("/{id}")
    public String updateOrder(@PathParam("id") Long id) {
        return "更新订单ID: " + id;
    }

    @DELETE
    @Path("/{id}")
    public String deleteOrder(@PathParam("id") Long id) {
        return "删除订单ID: " + id;
    }

    @GET
    @Path("/status/{status}")
    public String getOrdersByStatus(@PathParam("status") String status) {
        return "订单状态: " + status;
    }

    @GET
    @Path("/search")
    public String searchOrders(@QueryParam("keyword") String keyword) {
        return "搜索订单: " + keyword;
    }
}