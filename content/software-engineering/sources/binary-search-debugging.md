# Binary-search debugging

1. Binary-search debugging finds a problem by repeatedly cutting the search space in half.
2. git bisect finds the commit that introduced a bug: you mark one commit good and one bad, and git checks out the commit in the middle for you to test.
3. Each test halves the number of candidate commits, so about 1,000 commits take only about 10 steps.
4. git bisect run can automate the search with a test script that exits with 0 when the commit is good and with 1 when it is bad.
5. The same idea works without git: disable half of the code, configuration or input data, see if the bug remains, and repeat on the half that still fails.
6. Binary search needs a reliable reproduction, because a single wrong good or bad answer sends the search the wrong way.
