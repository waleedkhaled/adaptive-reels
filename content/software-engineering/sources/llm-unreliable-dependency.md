# LLM calls as unreliable dependencies

1. Treat a model API like any network dependency: calls can be slow, fail, or hit rate limits.
2. A model can also return output that is malformed or wrong even when the call succeeds.
3. Set a timeout on every model call so a slow response cannot hang your request.
4. Retry temporary failures, such as timeouts, 429 and 5xx responses, with exponential backoff and jitter; do not retry requests that failed because they were invalid.
5. Validate every response against the format you expect, and retry or repair when it does not match.
6. The same prompt can produce different outputs on different calls, so code must handle variation.
7. Log the model, prompt version, latency, token counts and errors for each call, so failures can be investigated.
