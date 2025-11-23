package com.example.training.common.controller;

import com.example.training.common.service.ExternalApiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/external")
public class ExternalApiController {

    private final ExternalApiService externalApiService;

    public ExternalApiController(ExternalApiService externalApiService) {
        this.externalApiService = externalApiService;
    }

    @GetMapping("/example")
    public ResponseEntity<Map<String, Object>> getExternalData() {
        Map<String, Object> data = externalApiService.fetchExternalData();
        return ResponseEntity.ok(data);
    }
}
