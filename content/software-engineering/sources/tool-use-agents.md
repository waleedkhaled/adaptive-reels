# Tool use and agents

1. With tool use, you describe functions the model may call; instead of text, the model can return a tool call with the function name and arguments as JSON.
2. Your code runs the tool, sends the result back to the model, and the model continues with that information.
3. An agent is a loop: the model chooses a tool, your code runs it, the result goes back, and this repeats until the task is done.
4. Clear tool names and descriptions strongly affect whether the model picks the right tool with the right arguments.
5. Validate tool arguments before running a tool, because the model can produce wrong or malformed arguments.
6. Limit the number of loop iterations and the cost per task, so an agent cannot run forever.
7. Tools that change or delete things should ask a human for confirmation before they run.
8. The Model Context Protocol, MCP, is an open protocol for connecting models to tools and data sources in a standard way.
