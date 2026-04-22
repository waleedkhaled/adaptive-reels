# Evals

1. An eval is a set of test inputs with a way to grade the model's outputs, used to measure quality before and after a change.
2. Run your evals whenever you change a prompt, a model or a setting, so you catch regressions before users do.
3. Some outputs can be graded with code, such as exact matches, valid JSON or passing unit tests.
4. Open-ended outputs are often graded by another model, called LLM-as-judge; check the judge against human labels before trusting it.
5. Even a few dozen well-chosen examples catch many problems; add real failures from production as new test cases.
6. Track eval scores over time so you can see whether the system is getting better or worse.
