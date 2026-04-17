package com.example.jaxrs;

import javax.ws.rs.*;

@Path("/api")
public class ProductResource {

    @GET
    @Path("/products")
    public String getProducts() {
        return "products";
    }

    @POST
    @Path("/create")
    public String createProduct() {
        return "created";
    }

    @PUT
    @Path("/update")
    public String updateProduct() {
        return "updated";
    }

    @DELETE
    @Path("/delete")
    public String deleteProduct() {
        return "deleted";
    }

    @GET
    public String getAll() {
        return "all";
    }
}