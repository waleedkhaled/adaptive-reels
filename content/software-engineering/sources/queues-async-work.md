# Queues and async work

1. A queue lets one part of a system hand off work to be done later: a producer adds a job, and a worker takes it off the queue and processes it.
2. Moving slow work, such as sending email or calling a model, out of the request lets the request return quickly.
3. An API can accept a job, return an ID straight away, and let the client check the status or be notified when it finishes.
4. A queue absorbs spikes in traffic: jobs wait instead of overloading the workers.
5. Failed jobs can be retried with increasing delays; jobs that keep failing go to a dead-letter queue for inspection.
6. Many queues deliver each message at least once, so a worker can receive the same job twice and must handle duplicates safely.
