# Prometheus Queries - Stage 2 Observability

This document contains useful Prometheus queries for analyzing Sagaline platform metrics.

## Business Metrics

### User Registrations

```promql
# Total registrations (all time)
user_registrations_total

# Registrations in last hour
increase(user_registrations_total[1h])

# Registrations per minute (rate)
rate(user_registrations_total[5m]) * 60
```

### Orders

```promql
# Total orders created
orders_created_total{status="created"}

# Orders created in last 24 hours
increase(orders_created_total{status="created"}[24h])

# Order creation rate (orders/minute)
rate(orders_created_total[5m]) * 60

# Order confirmation rate
increase(orders_created_total{status="confirmed"}[1h])

# Order cancellation rate
increase(orders_created_total{status="cancelled"}[1h])

# Order conversion rate (confirmed / created)
(
  rate(orders_created_total{status="confirmed"}[5m]) /
  rate(orders_created_total{status="created"}[5m])
) * 100
```

### Payments

```promql
# Total successful payments
payment_transactions_total{status="success"}

# Payment success rate
(
  rate(payment_transactions_total{status="success"}[5m]) /
  rate(payment_transactions_total[5m])
) * 100

# Payment failure rate
(
  rate(payment_transactions_total{status="failed"}[5m]) /
  rate(payment_transactions_total[5m])
) * 100

# Payments by method
sum(payment_transactions_total) by (method)
```

### Revenue

```promql
# Total revenue (all time)
revenue_total{currency="KRW"}

# Revenue in last hour
increase(revenue_total{currency="KRW"}[1h])

# Revenue per minute
rate(revenue_total{currency="KRW"}[5m]) * 60

# Average order value
revenue_total{currency="KRW"} /
orders_created_total{status="confirmed"}
```

## HTTP Performance Metrics

### Request Rate

```promql
# Total requests per second
sum(rate(http_requests_total[5m]))

# Requests per second by endpoint
sum(rate(http_requests_total[5m])) by (endpoint)

# Requests per second by status code
sum(rate(http_requests_total[5m])) by (status)

# Successful requests (2xx)
sum(rate(http_requests_total{status=~"2.."}[5m]))

# Client errors (4xx)
sum(rate(http_requests_total{status=~"4.."}[5m]))

# Server errors (5xx)
sum(rate(http_requests_total{status=~"5.."}[5m]))
```

### Error Rate

```promql
# Overall error rate
(
  sum(rate(http_requests_total{status=~"5.."}[5m])) /
  sum(rate(http_requests_total[5m]))
) * 100

# Error rate by endpoint
(
  sum(rate(http_requests_total{status=~"5.."}[5m])) by (endpoint) /
  sum(rate(http_requests_total[5m])) by (endpoint)
) * 100

# 4xx rate (client errors)
(
  sum(rate(http_requests_total{status=~"4.."}[5m])) /
  sum(rate(http_requests_total[5m]))
) * 100
```

### Latency

```promql
# P50 latency (median)
histogram_quantile(0.50,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# P95 latency
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# P99 latency
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)

# P99 latency by endpoint
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)
)

# Average latency
rate(http_request_duration_seconds_sum[5m]) /
rate(http_request_duration_seconds_count[5m])

# Average latency by endpoint
rate(http_request_duration_seconds_sum[5m]) by (endpoint) /
rate(http_request_duration_seconds_count[5m]) by (endpoint)
```

### Throughput

```promql
# Requests per minute
sum(rate(http_requests_total[5m])) * 60

# Peak requests in last hour
max_over_time(sum(rate(http_requests_total[1m]))[1h:])

# Requests by method
sum(rate(http_requests_total[5m])) by (method)
```

## Database Metrics

### Connection Pool

```promql
# Active connections
hikaricp_connections_active

# Connection pool usage percentage
(hikaricp_connections_active / hikaricp_connections_max) * 100

# Idle connections
hikaricp_connections_idle

# Minimum idle connections
hikaricp_connections_min

# Maximum connections
hikaricp_connections_max

# Connection acquisition time (P99)
histogram_quantile(0.99,
  sum(rate(hikaricp_connections_acquire_bucket[5m])) by (le)
)

# Connection timeout count
increase(hikaricp_connections_timeout_total[5m])
```

### Query Performance

```promql
# Average query duration
rate(database_query_duration_seconds_sum[5m]) /
rate(database_query_duration_seconds_count[5m])

# Query duration by type
rate(database_query_duration_seconds_sum[5m]) by (query_type) /
rate(database_query_duration_seconds_count[5m]) by (query_type)

# Slow queries (> 1 second)
database_query_duration_seconds_count{le="1.0"} > 0

# Query rate (queries/sec)
sum(rate(database_query_duration_seconds_count[5m]))
```

## JVM Metrics

### Memory

```promql
# Heap memory used
jvm_memory_used_bytes{area="heap"}

# Heap memory max
jvm_memory_max_bytes{area="heap"}

# Heap usage percentage
(
  jvm_memory_used_bytes{area="heap"} /
  jvm_memory_max_bytes{area="heap"}
) * 100

# Non-heap memory used
jvm_memory_used_bytes{area="nonheap"}

# Memory committed
jvm_memory_committed_bytes

# Memory by pool
jvm_memory_used_bytes by (id)
```

### Garbage Collection

```promql
# GC count rate
rate(jvm_gc_pause_seconds_count[5m])

# GC time rate
rate(jvm_gc_pause_seconds_sum[5m])

# Average GC pause duration
rate(jvm_gc_pause_seconds_sum[5m]) /
rate(jvm_gc_pause_seconds_count[5m])

# GC by type
rate(jvm_gc_pause_seconds_count[5m]) by (action, cause)
```

### Threads

```promql
# Live threads
jvm_threads_live_threads

# Daemon threads
jvm_threads_daemon_threads

# Peak threads
jvm_threads_peak_threads

# Thread states
jvm_threads_states_threads by (state)
```

### Classes

```promql
# Loaded classes
jvm_classes_loaded_classes

# Unloaded classes
jvm_classes_unloaded_classes_total
```

## System Metrics

### CPU

```promql
# Process CPU usage (0-1)
process_cpu_usage

# Process CPU usage (percentage)
process_cpu_usage * 100

# System CPU usage
system_cpu_usage

# System CPU usage (percentage)
system_cpu_usage * 100

# CPU count
system_cpu_count
```

### Disk

```promql
# Disk total
disk_total_bytes

# Disk free
disk_free_bytes

# Disk used
disk_total_bytes - disk_free_bytes

# Disk usage percentage
(
  (disk_total_bytes - disk_free_bytes) /
  disk_total_bytes
) * 100
```

## User Journey & Funnel Analysis

### Conversion Rates

```promql
# Registration to Order conversion
(
  increase(orders_created_total{status="created"}[1h]) /
  increase(user_registrations_total[1h])
) * 100

# Order to Payment conversion
(
  increase(payment_transactions_total{status="success"}[1h]) /
  increase(orders_created_total{status="created"}[1h])
) * 100

# Order to Confirmation conversion
(
  increase(orders_created_total{status="confirmed"}[1h]) /
  increase(orders_created_total{status="created"}[1h])
) * 100

# End-to-end conversion (registration to confirmed order)
(
  increase(orders_created_total{status="confirmed"}[1h]) /
  increase(user_registrations_total[1h])
) * 100
```

### Funnel Steps

```promql
# Step 1: Registrations
increase(user_registrations_total[1h])

# Step 2: Orders created
increase(orders_created_total{status="created"}[1h])

# Step 3: Payments attempted
increase(payment_transactions_total[1h])

# Step 4: Payments successful
increase(payment_transactions_total{status="success"}[1h])

# Step 5: Orders confirmed
increase(orders_created_total{status="confirmed"}[1h])
```

## Alerting Queries

These queries are used in alert rules:

### High Error Rate

```promql
# Alert when error rate > 1% for 5 minutes
(
  sum(rate(http_requests_total{status=~"5.."}[5m])) /
  sum(rate(http_requests_total[5m]))
) > 0.01
```

### High Latency

```promql
# Alert when P99 > 200ms
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)
) > 0.2
```

### Connection Pool High

```promql
# Alert when connection pool > 80%
(
  hikaricp_connections_active /
  hikaricp_connections_max
) > 0.8
```

### High Memory Usage

```promql
# Alert when heap usage > 85%
(
  jvm_memory_used_bytes{area="heap"} /
  jvm_memory_max_bytes{area="heap"}
) > 0.85
```

### Service Down

```promql
# Alert when service is down
up{job="sagaline-app"} == 0
```

## Advanced Queries

### Top 5 Slowest Endpoints

```promql
topk(5,
  histogram_quantile(0.99,
    sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint)
  )
)
```

### Top 5 Endpoints by Traffic

```promql
topk(5,
  sum(rate(http_requests_total[5m])) by (endpoint)
)
```

### Endpoints with Highest Error Rate

```promql
topk(5,
  sum(rate(http_requests_total{status=~"5.."}[5m])) by (endpoint) /
  sum(rate(http_requests_total[5m])) by (endpoint)
)
```

### Request Rate Prediction (Linear)

```promql
# Predict request rate in 1 hour
predict_linear(http_requests_total[1h], 3600)
```

### Memory Usage Prediction

```promql
# Predict heap usage in 1 hour
predict_linear(jvm_memory_used_bytes{area="heap"}[1h], 3600)
```

### Apdex Score (Application Performance Index)

```promql
# Apdex with T=100ms (satisfied), T*4=400ms (tolerating)
(
  sum(rate(http_request_duration_seconds_bucket{le="0.1"}[5m])) +
  sum(rate(http_request_duration_seconds_bucket{le="0.4"}[5m])) / 2
) / sum(rate(http_request_duration_seconds_count[5m]))
```

### Request Duration Heatmap

```promql
# For Grafana heatmap visualization
sum(increase(http_request_duration_seconds_bucket[1m])) by (le)
```

## Recording Rules (Recommended)

For better performance, create these recording rules in Prometheus:

```yaml
groups:
  - name: sagaline_recording_rules
    interval: 30s
    rules:
      # Request rate
      - record: job:http_requests:rate5m
        expr: sum(rate(http_requests_total[5m]))

      # Error rate
      - record: job:http_errors:rate5m
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m]))

      # P99 latency
      - record: job:http_request_duration:p99
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          )

      # Connection pool usage
      - record: job:db_connection_pool:usage
        expr: hikaricp_connections_active / hikaricp_connections_max
```

## Usage Tips

1. **Time Ranges**: Adjust `[5m]` to match your needs (e.g., `[1m]`, `[1h]`, `[24h]`)
2. **Rate vs Increase**: Use `rate()` for per-second rates, `increase()` for totals
3. **Histogram Quantiles**: Always use with `rate()`, not raw buckets
4. **Label Filtering**: Use `{label="value"}` to filter metrics
5. **Aggregation**: Use `sum()`, `avg()`, `min()`, `max()` for aggregation
6. **Grouping**: Use `by (label)` to group results

## Resources

- [Prometheus Query Documentation](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [PromQL Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)
