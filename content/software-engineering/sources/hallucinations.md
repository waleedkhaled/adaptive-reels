# Hallucinations

1. A hallucination is a fluent, confident model output that is false or not supported by any source.
2. Language models generate likely-sounding text; they have no built-in step that checks facts.
3. Models can invent citations, quotes, API functions or package names that do not exist.
4. Attackers can publish malicious packages under names that models tend to invent, so verify a package exists and is the real one before installing it.
5. Grounding the model in retrieved sources and asking it to cite them reduces hallucinations and makes them easier to spot.
6. Allowing the model to say it does not know, instead of forcing an answer, reduces made-up answers.
7. Hallucinations cannot be eliminated completely, so important outputs need verification by code, tools or people.
