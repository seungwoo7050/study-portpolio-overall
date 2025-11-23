package com.sagaline;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SagalineApplication {

    public static void main(String[] args) {
        SpringApplication.run(SagalineApplication.class, args);
    }
}
