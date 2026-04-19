package com.example.controller;

import javax.ws.rs.*;
import java.util.List;

/**
 * JAX-RS 测试 - 类级别路径结尾带斜杠
 */
@Path("/api/reports/")
public class ReportResource {

    @GET
    public List<String> getAllReports() {
        return List.of("报告1", "报告2", "报告3");
    }

    @GET
    @Path("/{id}")
    public String getReportById(@PathParam("id") Long id) {
        return "报告ID: " + id;
    }

    @GET
    @Path("/test/")
    public String testEndpoint() {
        return "JAX-RS 测试端点 - 结尾带斜杠";
    }

    @GET
    @Path("/{type}/summary")
    public String getReportSummary(@PathParam("type") String type) {
        return type + " 类型报告摘要";
    }

    @GET
    @Path("/date/{year}/{month}")
    public String getReportByDate(
            @PathParam("year") int year,
            @PathParam("month") int month) {
        return year + "年" + month + "月的报告";
    }

    @POST
    public String createReport() {
        return "创建报告成功";
    }

    @PUT
    @Path("/{id}")
    public String updateReport(@PathParam("id") Long id) {
        return "更新报告ID: " + id;
    }

    @DELETE
    @Path("/{id}")
    public String deleteReport(@PathParam("id") Long id) {
        return "删除报告ID: " + id;
    }

    // JAX-RS 参数查询
    @GET
    @Path("/search")
    public String searchReports(
            @QueryParam("keyword") String keyword,
            @QueryParam("limit") @DefaultValue("10") int limit) {
        return "搜索: " + keyword + " (限制: " + limit + ")";
    }

    // JAX-RS 矩阵参数
    @GET
    @Path("/filter")
    public String filterReports(@MatrixParam("status") String status) {
        return "过滤状态: " + status;
    }
}