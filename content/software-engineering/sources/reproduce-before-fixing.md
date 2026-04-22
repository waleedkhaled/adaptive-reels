# Reproduce before fixing

1. A reproduction is a set of steps, inputs and conditions that makes a bug happen reliably.
2. Before changing any code, make the bug happen on demand. A fix you cannot reproduce is a fix you cannot verify.
3. Write down the exact steps, the inputs, and the environment: operating system, device, app version and configuration.
4. Shrink the reproduction to the smallest case that still fails. Remove steps, data and code until removing anything else makes the bug disappear.
5. Turn the reproduction into an automated test that fails. After the fix the test passes, and it keeps guarding against the bug coming back.
6. Bugs that appear only sometimes often involve timing, shared state, caching, network conditions, or differences between environments.
7. If you cannot reproduce a bug, gather more evidence before guessing: logs, error reports, screenshots, and the exact version the user ran.
8. Fixing a symptom you have not reproduced risks changing the wrong code while the real bug stays.
