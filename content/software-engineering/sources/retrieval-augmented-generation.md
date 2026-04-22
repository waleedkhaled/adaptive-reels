# Retrieval-augmented generation

1. Retrieval-augmented generation, RAG, finds relevant passages from your own documents and adds them to the prompt so the model can answer from them.
2. Documents are split into chunks, and each chunk is stored with an embedding, a vector of numbers where texts with similar meaning are close together.
3. At question time, the question is embedded too and the closest chunks are retrieved, often from a vector database.
4. If the retrieval step misses the right chunk, the model cannot use that information, so retrieval quality limits answer quality.
5. Combining keyword search with vector search, and reranking the results, often retrieves better chunks than either alone.
6. Asking the model to cite which retrieved passage supports each statement makes answers easier to check.
7. RAG lets a model use information that is newer than its training data or private to your organisation, without retraining the model.
