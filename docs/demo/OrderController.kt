package com.example.kotlin

import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api")
class OrderController {

    @GetMapping("/orders")
    fun getOrders(): String {
        return "orders"
    }

    @PostMapping("/create")
    fun createOrder(): String {
        return "created"
    }

    @GetMapping"/simple"
    fun simple(): String {
        return "simple"
    }
}