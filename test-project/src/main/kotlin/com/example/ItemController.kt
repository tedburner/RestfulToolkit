package com.example

import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/items")
class ItemController {

    @GetMapping
    fun getAllItems(): String {
        return "所有商品"
    }

    @GetMapping("/{id}")
    fun getItemById(@PathVariable id: Long): String {
        return "商品ID: $id"
    }

    @PostMapping
    fun createItem(): String {
        return "创建商品成功"
    }

    @PutMapping("/{id}")
    fun updateItem(@PathVariable id: Long): String {
        return "更新商品ID: $id"
    }

    @DeleteMapping("/{id}")
    fun deleteItem(@PathVariable id: Long): String {
        return "删除商品ID: $id"
    }

    @GetMapping("/special")
    fun getSpecialItems(): String {
        return "特价商品"
    }
}