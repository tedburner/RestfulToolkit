package com.example.sample.jaxrs;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import java.util.List;

@Path("/api/orders")
public class OrderResource {

    @GET
    public List<String> list(@QueryParam("status") String status) {
        return List.of();
    }

    @GET
    @Path("/{id}")
    public String get(@PathParam("id") long id) {
        return "order";
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public String create(String payload) {
        return "created";
    }

    @PUT
    @Path("/{id}")
    public String update(@PathParam("id") long id, String payload) {
        return "updated";
    }

    @DELETE
    @Path("/{id}")
    public void delete(@PathParam("id") long id) {
    }

    @POST
    @Path("/form")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    public String form(@FormParam("name") String name,
                       @FormParam("qty") int qty) {
        return "ok";
    }
}
