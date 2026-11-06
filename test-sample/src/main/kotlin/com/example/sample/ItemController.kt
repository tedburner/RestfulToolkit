package com.example.sample;

import com.example.sample.dto.ItemDto;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/items")
class ItemController {

    @GetMapping
    fun list(@RequestParam(required = false) keyword: String?): List<ItemDto> {
        return emptyList()
    }

    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): ItemDto? {
        return null
    }

    @PostMapping
    fun create(@RequestBody item: ItemDto): ItemDto {
        return item
    }

    @PutMapping("/{id}")
    fun update(@PathVariable id: Long, @RequestBody item: ItemDto): ItemDto {
        return item
    }

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Long) {
    }

    // Kotlin 默认值 + 可空参数
    @GetMapping("/search")
    fun search(@RequestParam(defaultValue = "10") limit: Int = 10,
               @RequestParam q: String? = null): List<ItemDto> {
        return emptyList()
    }

    // 表达式函数体（Spring 解析器可识别）
    @GetMapping("/ping")
    fun ping(): String = "pong"

    // 跨行注解
    @GetMapping(
        "/multi-line"
    )
    fun multiLine(): String {
        return "ok"
    }
}
