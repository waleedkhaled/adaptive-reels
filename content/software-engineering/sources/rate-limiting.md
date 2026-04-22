# Rate limiting

1. Rate limiting caps how many requests a client can make in a period of time.
2. When the limit is exceeded, HTTP APIs respond with status 429 Too Many Requests, often with a Retry-After header saying when to try again.
3. A token bucket allows short bursts up to the bucket size while refilling at a steady rate.
4. A fixed window counts requests per clock interval; a sliding window smooths out the burst that can happen at window boundaries.
5. Model providers usually limit both requests per minute and tokens per minute.
6. Clients should retry after a 429 with exponential backoff and random jitter, so many clients do not retry at the same moment.
7. Rate limiting your own users' AI features also caps how much a single user can cost you.
