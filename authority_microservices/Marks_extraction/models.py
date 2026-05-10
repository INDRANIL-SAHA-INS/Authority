from langchain_ollama import ChatOllama

# Configuration for the local Ollama model used for Schema Discovery
llm = ChatOllama(
    model="gemma3:4b",    # Or whatever model you have pulled locally
    temperature=0,        # Zero temperature for consistent mapping
    format="json"         # Ensure the model returns valid JSON
)
