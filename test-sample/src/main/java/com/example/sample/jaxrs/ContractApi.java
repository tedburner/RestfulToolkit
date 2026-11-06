package com.example.sample.jaxrs;

import javax.ws.rs.*;

@Path("/api/contracts")
public interface ContractApi {

    @GET
    @Path("/{id}")
    String getContract(@PathParam("id") String id);

    @POST
    String createContract(String payload);
}
