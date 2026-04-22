# Observability

1. Observability is being able to understand what a system is doing from the data it emits: logs, metrics and traces.
2. Logs record individual events; metrics are numbers tracked over time, such as error rate; traces follow one request across services.
3. A request ID passed through every service and log line lets you connect everything that happened for one request.
4. For model calls, record the model, prompt version, input and output token counts, latency, cost and errors.
5. Latency percentiles such as p95 and p99 show the slow experiences that an average hides.
6. OpenTelemetry is an open standard for collecting traces, metrics and logs from many languages and tools.
7. Alerts should fire on symptoms users feel, such as errors and slowness, and logs should not contain secrets or unnecessary personal data.
