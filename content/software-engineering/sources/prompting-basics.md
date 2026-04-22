# Prompting

1. A prompt works better when it states the task, the audience, the constraints and the output format explicitly.
2. Examples of good input and output pairs in the prompt, called few-shot examples, show the model what you want more reliably than descriptions alone.
3. The system prompt sets rules and context that apply to the whole conversation.
4. Separating instructions from the data they apply to, for example with clear delimiters or tags, helps the model tell them apart.
5. For complex tasks, asking the model to reason step by step before giving its answer can improve accuracy.
6. A lower temperature makes outputs more focused and repeatable, but even at temperature 0 outputs are not guaranteed to be identical every time.
7. Improving a prompt works best with a set of test inputs, so you can see whether a change helps or hurts.
