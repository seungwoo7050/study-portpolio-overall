package com.example.training.common.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Service
public class ExternalApiService {

    private static final Logger log = LoggerFactory.getLogger(ExternalApiService.class);
    private static final String EXTERNAL_API_URL = "https://jsonplaceholder.typicode.com/posts/1";

    private final WebClient webClient;

    public ExternalApiService(WebClient webClient) {
        this.webClient = webClient;
    }

    public Map<String, Object> fetchExternalData() {
        log.info("Fetching data from external API: {}", EXTERNAL_API_URL);

        try {
            Map<String, Object> response = webClient.get()
                .uri(EXTERNAL_API_URL)
                .retrieve()
                .bodyToMono(Map.class)
                .retryWhen(Retry.fixedDelay(3, Duration.ofSeconds(1))
                    .doBeforeRetry(retrySignal ->
                        log.warn("Retrying request, attempt: {}", retrySignal.totalRetries() + 1)
                    )
                    .onRetryExhaustedThrow((retryBackoffSpec, retrySignal) -> {
                        log.error("Max retry attempts reached");
                        return new RuntimeException("Max retry attempts reached");
                    })
                )
                .onErrorResume(throwable -> {
                    log.error("Error fetching external data, using fallback", throwable);
                    return Mono.just(getFallbackResponse());
                })
                .block();

            log.info("Successfully fetched external data");
            return response;

        } catch (Exception e) {
            log.error("Unexpected error while fetching external data, using fallback", e);
            return getFallbackResponse();
        }
    }

    private Map<String, Object> getFallbackResponse() {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("status", "fallback");
        fallback.put("message", "External API is currently unavailable. Using cached or default data.");
        fallback.put("userId", 1);
        fallback.put("id", 1);
        fallback.put("title", "Fallback Title");
        fallback.put("body", "Fallback body content");
        return fallback;
    }
}
