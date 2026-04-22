# Idempotency

1. An operation is idempotent when doing it several times has the same effect as doing it once.
2. In HTTP, GET, PUT and DELETE are defined as idempotent, while POST is not.
3. Retries are only safe for idempotent operations: after a timeout, the client cannot know whether the first attempt succeeded.
4. An idempotency key is a unique ID the client sends with a request; the server stores the result under that key and returns the same result if the request is repeated.
5. Payment APIs such as Stripe use idempotency keys so a retried request does not charge the customer twice.
6. Workers that consume queues should be idempotent, because the same message can be delivered more than once.
