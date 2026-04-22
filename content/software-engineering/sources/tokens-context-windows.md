# Tokens and context windows

1. Language models read and write text as tokens, which are chunks of text such as whole words, parts of words, or punctuation.
2. In English text, one token is on average about four characters, or roughly three quarters of a word. The exact count depends on the model's tokenizer.
3. Code, numbers and non-English text often use more tokens per character than plain English prose.
4. The context window is the maximum number of tokens a model can handle in one request.
5. Everything in a request counts toward the context window: the system prompt, the conversation so far, any documents you include, and, for most models, the output the model generates.
6. Hosted models are usually billed per token, with separate prices for input and output tokens, and output tokens typically cost more than input tokens.
7. When a conversation or document is longer than the context window, something has to give: older messages are dropped or summarised, or only the most relevant parts are retrieved and included.
8. A bigger context window does not guarantee better answers. Studies have found that models can be less reliable at using information buried in the middle of very long contexts.
