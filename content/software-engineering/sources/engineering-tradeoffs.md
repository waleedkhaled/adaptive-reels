# Trade-offs

1. Almost every engineering decision trades one good thing for another, such as speed for freshness, or flexibility for simplicity.
2. Caching is a typical trade-off: responses get faster, but data can be stale.
3. In a distributed system, when the network between parts fails, the system has to choose between staying consistent and staying available.
4. Build versus buy trades control and fit against time, cost and maintenance.
5. Writing down the options you considered and why you chose one, for example in an architecture decision record, helps future readers understand the trade-off.
6. Decisions that are easy to reverse can be made quickly; decisions that are hard to undo deserve more care.
