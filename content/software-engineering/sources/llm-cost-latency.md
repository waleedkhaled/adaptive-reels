# Cost and latency

1. The cost of a model call is the input tokens times the input price plus the output tokens times the output price.
2. Models generate output tokens one at a time, so long outputs take longer; output length is a major driver of latency.
3. Time to first token is how long the user waits before anything appears; streaming shows tokens as they are generated, which makes responses feel faster.
4. Smaller models are usually cheaper and faster, but may be less capable, so pick the smallest model that passes your evals.
5. Reasoning models spend extra output tokens thinking before they answer, which adds cost and latency.
6. Caching repeated prompts or responses reduces both cost and latency.
7. Some providers offer discounted batch processing for work that does not need an immediate answer.
