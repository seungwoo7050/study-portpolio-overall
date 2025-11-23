package com.sagaline.common.event;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@Profile("!test")
public class EventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final MeterRegistry meterRegistry;

    public EventPublisher(KafkaTemplate<String, Object> kafkaTemplate, MeterRegistry meterRegistry) {
        this.kafkaTemplate = kafkaTemplate;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Publish an event to a Kafka topic
     *
     * @param topic the topic name
     * @param event the event to publish
     */
    public void publish(String topic, BaseEvent event) {
        Timer.Sample sample = Timer.start(meterRegistry);

        try {
            CompletableFuture<SendResult<String, Object>> future = kafkaTemplate.send(topic, event.getEventId(), event);

            future.whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish event: topic={}, eventId={}, eventType={}",
                            topic, event.getEventId(), event.getEventType(), ex);

                    Counter.builder("kafka.events.published")
                            .tag("topic", topic)
                            .tag("event_type", event.getEventType())
                            .tag("status", "failed")
                            .description("Number of Kafka events published")
                            .register(meterRegistry)
                            .increment();
                } else {
                    log.info("Event published successfully: topic={}, eventId={}, eventType={}, partition={}, offset={}",
                            topic, event.getEventId(), event.getEventType(),
                            result.getRecordMetadata().partition(),
                            result.getRecordMetadata().offset());

                    Counter.builder("kafka.events.published")
                            .tag("topic", topic)
                            .tag("event_type", event.getEventType())
                            .tag("status", "success")
                            .description("Number of Kafka events published")
                            .register(meterRegistry)
                            .increment();

                    sample.stop(Timer.builder("kafka.publish.duration")
                            .tag("topic", topic)
                            .tag("event_type", event.getEventType())
                            .description("Time to publish event to Kafka")
                            .register(meterRegistry));
                }
            });

        } catch (Exception e) {
            log.error("Error publishing event: topic={}, eventId={}, eventType={}",
                    topic, event.getEventId(), event.getEventType(), e);

            Counter.builder("kafka.events.published")
                    .tag("topic", topic)
                    .tag("event_type", event.getEventType())
                    .tag("status", "error")
                    .description("Number of Kafka events published")
                    .register(meterRegistry)
                    .increment();
        }
    }
}
