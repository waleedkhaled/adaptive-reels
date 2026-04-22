# Structured output

1. Structured output means getting a model to return data, such as JSON, that your code can parse instead of free text.
2. JSON mode makes the model return syntactically valid JSON, but does not guarantee the fields you expect.
3. Structured outputs with a JSON Schema constrain the model's output to match that schema.
4. Validate the parsed output with a schema validator such as Zod anyway, because providers and models differ in how strictly they enforce schemas.
5. If the output hits the maximum token limit, the JSON is cut off and will not parse.
6. Enums for fixed choices, such as 'positive' | 'negative' | 'neutral', are easier for models to follow and for code to handle than free text.
7. When validation fails, sending the errors back to the model and asking for a corrected version often fixes the output.
