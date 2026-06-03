package com.example.resource;

import com.example.dto.*;
import javax.ws.rs.*;
import java.util.List;

/**
 * 跨包引用测试 Resource
 *
 * 覆盖场景：
 * - 通配符 import com.example.dto.*，测试 buildPotentialFQNs 通配符展开
 * - @QueryParam + @PathParam 混合参数
 * - 类名 SearchableResource 包含 camelCase，测试搜索边界匹配
 */
@Path("/api/searchable")
public class SearchableResource {

    @GET
    @Path("/query")
    public List<String> queryItems(@QueryParam("keyword") String keyword) {
        return List.of("result1", "result2");
    }

    @POST
    @Path("/import")
    public String importData(@QueryParam("source") String source) {
        return "imported from " + source;
    }

    @GET
    @Path("/items/{itemId}")
    public String getSearchableItem(@PathParam("itemId") Long itemId) {
        return "Item: " + itemId;
    }

    @DELETE
    @Path("/items/{itemId}")
    public String removeSearchableItem(@PathParam("itemId") Long itemId) {
        return "Removed: " + itemId;
    }
}
