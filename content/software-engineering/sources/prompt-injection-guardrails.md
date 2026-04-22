# Prompt injection and guardrails

1. Prompt injection is when untrusted text, such as a web page, an email, a document or user input, contains instructions that the model then follows.
2. Indirect prompt injection arrives through content the model reads while working, such as retrieved documents or tool results, not from the user directly.
3. Prompt injection is ranked first in the OWASP Top 10 for Large Language Model Applications.
4. There is currently no complete, reliable fix for prompt injection, so systems must limit what an injected instruction can do.
5. Give the model only the tools and permissions it needs, and require human confirmation for sensitive or destructive actions.
6. The riskiest setup combines access to private data, exposure to untrusted content, and a way to send data out.
7. Never execute model output directly, such as running generated code or SQL, without validation and sandboxing.
