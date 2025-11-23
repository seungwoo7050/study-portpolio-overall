package com.example.training.config;

import com.example.training.search.repository.ProductSearchRepository;
import org.mockito.Mockito;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;

@Configuration
@Profile("test")
public class TestSearchConfig {

    @Bean
    @Primary
    public ProductSearchRepository productSearchRepository() {
        return Mockito.mock(ProductSearchRepository.class);
    }

    @Bean
    @Primary
    public ElasticsearchOperations elasticsearchOperations() {
        return Mockito.mock(ElasticsearchOperations.class);
    }
}
