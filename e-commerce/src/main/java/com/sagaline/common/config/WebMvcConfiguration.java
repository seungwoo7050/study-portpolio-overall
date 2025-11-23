package com.sagaline.common.config;

import com.sagaline.common.metrics.HttpMetricsInterceptor;
import com.sagaline.common.ratelimit.RateLimitInterceptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC configuration for interceptors and other web settings
 */
@Configuration
public class WebMvcConfiguration implements WebMvcConfigurer {

    private final HttpMetricsInterceptor httpMetricsInterceptor;
    private final ObjectProvider<RateLimitInterceptor> rateLimitInterceptorProvider;

    public WebMvcConfiguration(HttpMetricsInterceptor httpMetricsInterceptor,
                               ObjectProvider<RateLimitInterceptor> rateLimitInterceptorProvider) {
        this.httpMetricsInterceptor = httpMetricsInterceptor;
        this.rateLimitInterceptorProvider = rateLimitInterceptorProvider;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        RateLimitInterceptor rateLimitInterceptor = rateLimitInterceptorProvider.getIfAvailable();
        if (rateLimitInterceptor != null) {
            registry.addInterceptor(rateLimitInterceptor)
                    .addPathPatterns("/api/**")
                    .excludePathPatterns("/actuator/**")
                    .order(1);
        }

        registry.addInterceptor(httpMetricsInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/actuator/**")
                .order(2);
    }
}
