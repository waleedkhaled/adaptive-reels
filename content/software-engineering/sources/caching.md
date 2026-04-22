# Caching

1. A cache stores the result of an expensive operation so later requests can reuse it instead of recomputing or refetching it.
2. A cache hit is when the requested result is already in the cache; a cache miss is when it is not and the work has to be done.
3. The hit rate is the share of requests served from the cache. A higher hit rate means less load on the slow system behind the cache.
4. The main risk of caching is stale data: the cache returns an old result after the real data has changed.
5. Every cache needs an invalidation strategy, such as a time-to-live after which entries expire, deleting entries when the underlying data changes, or putting a version in the cache key.
6. A cache key must include everything the result depends on. If two different requests share a key, users can receive each other's results.
7. In applications that call language models, caching responses to identical requests avoids paying for the same tokens twice and returns answers faster.
8. Many model providers also offer prompt caching, which charges less for a repeated prompt prefix, such as a long system prompt sent with every request.
9. Caching a model's response means every user who sends that request gets the same answer, even when the model would otherwise vary its output.
