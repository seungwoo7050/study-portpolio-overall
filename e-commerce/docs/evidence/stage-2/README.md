# Stage 2: Observability - Evidence Package

This directory contains evidence and documentation for Stage 2 (Observability) implementation.

## Contents

- `validation-report.md` - Comprehensive validation report with all implementation details
- `prometheus-queries.md` - Sample Prometheus queries for metrics analysis
- `grafana-screenshots/` - Screenshots of Grafana dashboards (to be added after startup)
- `trace-examples/` - Sample distributed trace screenshots (to be added after startup)

## Quick Start

### 1. Start Observability Stack

```bash
cd infrastructure/docker
docker-compose up -d

# Wait for all services to be healthy (30-60 seconds)
docker-compose ps
```

### 2. Start Application

```bash
mvn spring-boot:run
```

### 3. Access Observability Tools

| Tool | URL | Credentials |
|------|-----|-------------|
| Application | http://localhost:8080 | - |
| Metrics (Prometheus) | http://localhost:8080/actuator/prometheus | - |
| Prometheus UI | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin/admin |
| Zipkin | http://localhost:9411 | - |
| Kibana | http://localhost:5601 | - |
| Alertmanager | http://localhost:9093 | - |

### 4. Generate Test Data

```bash
# Register a user
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User","phoneNumber":"010-1234-5678"}'

# Login to get token
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token')

# Create an order
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": "123 Test Street",
    "shippingCity": "Seoul",
    "shippingPostalCode": "12345"
  }'
```

### 5. Verify Metrics

```bash
# Check metrics endpoint
curl http://localhost:8080/actuator/prometheus | grep user_registrations_total
curl http://localhost:8080/actuator/prometheus | grep orders_created_total
curl http://localhost:8080/actuator/prometheus | grep revenue_total
```

### 6. View in Grafana

1. Open http://localhost:3000
2. Login: admin/admin
3. Navigate to "Dashboards"
4. Open "Sagaline - Platform Overview"
5. Observe metrics updating in real-time

## Key Metrics

### Business Metrics
- `user_registrations_total` - Total user registrations
- `orders_created_total{status}` - Orders by status
- `payment_transactions_total{status,method}` - Payment transactions
- `revenue_total{currency}` - Total revenue

### Technical Metrics
- `http_requests_total{endpoint,method,status}` - HTTP request counts
- `http_request_duration_seconds{endpoint,method}` - Request latency
- `database_query_duration_seconds{query_type}` - Database performance
- `hikaricp_connections_active` - Connection pool usage
- `jvm_memory_used_bytes{area}` - JVM memory usage

## Grafana Dashboard Panels

1. System Overview - Request Rate
2. System Overview - API Latency (P99)
3. Business Metrics - Registrations & Orders
4. Business Metrics - Revenue (KRW)
5. Database Performance - Query Duration
6. Database Performance - Connection Pool
7. User Journey - Conversion Funnel
8. Error Tracking - HTTP Errors by Status
9. Error Tracking - Error Rate
10. JVM Metrics - Memory Usage
11. JVM Metrics - Threads
12. API Endpoints - Latency by Endpoint
13. Infrastructure - CPU Usage
14. Infrastructure - Disk Usage

## Alert Rules

1. **HighErrorRate**: Fires when error rate > 1% for 5 minutes
2. **HighLatency**: Fires when P99 latency > 200ms for 5 minutes
3. **DatabaseConnectionPoolHigh**: Fires when connection pool > 80%
4. **HighDiskUsage**: Fires when disk usage > 85%
5. **ServiceDown**: Fires when application is unreachable
6. **HighMemoryUsage**: Fires when JVM heap > 85%
7. **NoRequestsReceived**: Fires when no traffic for 10 minutes

## Distributed Tracing

### View Traces in Zipkin

1. Open http://localhost:9411
2. Click "Run Query" to see recent traces
3. Click on any trace to see detailed span hierarchy
4. Observe request flow: HTTP → Service → Database

### Trace ID Correlation

Trace IDs are included in:
- HTTP response headers (`X-B3-TraceId`)
- Application logs (JSON field: `traceId`)
- Metrics labels (where applicable)

Use trace ID to correlate:
- Metrics → Logs → Traces

## Log Analysis in Kibana

### Create Index Pattern

1. Open http://localhost:5601
2. Go to "Management" → "Index Patterns"
3. Create pattern: `sagaline-logs-*`
4. Select `@timestamp` as time field

### Search Logs

```
# Find all logs for a specific trace
traceId: "abc123def456"

# Find all errors
level: ERROR

# Find logs for specific user
userId: "12345"

# Find slow requests
duration_ms: >1000
```

## Troubleshooting

### Services Not Starting

```bash
# Check service status
docker-compose ps

# View logs for specific service
docker-compose logs -f prometheus
docker-compose logs -f grafana
docker-compose logs -f elasticsearch

# Restart services
docker-compose restart
```

### No Metrics Showing

1. Verify application is running: `curl http://localhost:8080/actuator/health`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify target is UP and scraping
4. Check application logs for errors

### Grafana Dashboard Empty

1. Verify Prometheus datasource: "Configuration" → "Data Sources"
2. Test connection
3. Check time range (default: last 6 hours)
4. Generate test traffic to create metrics

### No Traces in Zipkin

1. Verify Zipkin is running: `curl http://localhost:9411/health`
2. Check application configuration: `management.zipkin.tracing.endpoint`
3. Verify sampling is enabled: `management.tracing.sampling.probability=1.0`
4. Generate test requests

## Performance

### Resource Usage (Expected)

| Service | CPU | Memory |
|---------|-----|--------|
| Application | < 50% | ~512MB |
| Prometheus | < 10% | ~200MB |
| Grafana | < 5% | ~150MB |
| Elasticsearch | < 20% | ~512MB |
| Logstash | < 10% | ~256MB |
| Zipkin | < 5% | ~150MB |

### Overhead Impact

- Metrics collection: < 1ms per request
- Structured logging: < 2ms per request (async)
- Distributed tracing: < 5ms per request (100% sampling)
- **Total overhead**: < 10ms per request

## Production Recommendations

1. **Reduce Trace Sampling**: Change `management.tracing.sampling.probability` to `0.1` (10%)
2. **Configure External Alerts**: Set up email/Slack/PagerDuty in Alertmanager
3. **Increase Retention**: Adjust Prometheus retention (`--storage.tsdb.retention.time`)
4. **Enable Security**: Add authentication to all observability tools
5. **Cluster Elasticsearch**: Use multiple nodes for high availability
6. **Use Log Shippers**: Deploy Filebeat for log collection
7. **Monitor Monitoring**: Set up alerts for observability stack health

## References

- [Validation Report](./validation-report.md) - Complete implementation details
- [Prometheus Queries](./prometheus-queries.md) - Useful queries for analysis
- [CLAUDE.md](../../CLAUDE.md) - Stage 2 requirements

---

**Implementation Date**: 2025-11-15
**Status**: ✅ Complete
**Next Stage**: Stage 3 (Scale)
