# Reading error messages

1. Read the whole error message before acting; the first line usually names the type of error and what went wrong.
2. A stack trace lists the function calls that led to the error, with the place where it was thrown at the top.
3. Look for the first stack frame in your own code: that is usually the best place to start investigating.
4. Many errors include a cause or an earlier error; the first error in a log is often the real problem and later ones are consequences.
5. Searching the exact error message in quotes often finds others who hit the same problem.
6. Source maps translate line numbers in bundled or minified code back to your original source files.
7. Reading the error carefully is faster than guessing, because the message often names the file, line and value involved.
