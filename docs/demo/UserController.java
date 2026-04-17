package com.example.demo.controller;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class UserController {

    @GetMapping("/users")
    public String getUsers() {
        return "users";
    }

    @PostMapping("/create")
    public String createUser() {
        return "created";
    }

    @PutMapping("/update")
    public String updateUser() {
        return "updated";
    }

    @DeleteMapping("/delete")
    public String deleteUser() {
        return "deleted";
    }

    @PatchMapping("/patch")
    public String patchUser() {
        return "patched";
    }

    @RequestMapping(path = "/list", method = RequestMethod.GET)
    public String listUsers() {
        return "list";
    }

    @GetMapping({"/multi1", "/multi2"})
    public String multiPath() {
        return "multi";
    }
}