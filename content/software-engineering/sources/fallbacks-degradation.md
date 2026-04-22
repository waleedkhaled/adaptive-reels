# Fallbacks and graceful degradation

1. Graceful degradation means that when a dependency fails, the product keeps working with reduced features instead of failing completely.
2. Fallbacks for a model call include a cached answer, a smaller or backup model, another provider, a simple rule-based default, or queueing the work for later.
3. A circuit breaker stops calling a dependency that keeps failing for a cooldown period, which protects both your system and the dependency.
4. Fallback paths must be tested, because code that only runs during outages is often broken when it is finally needed.
5. Tell users when they are getting a degraded result, so they are not misled.
