# Configuration and model setup
from langchain_ollama import ChatOllama

# gemma3-tools is fine-tuned for function/tool calling — ideal for structured output
llm = ChatOllama(
    model="PetrosStav/gemma3-tools:4b",
    temperature=0,       # deterministic — no creative variance in structured tasks
    num_predict=2048,    # cap token output so it doesn't ramble
)
llm2 = ChatOllama(
    model="llama3.2:latest",
    temperature=0.2,
    
)

llm3 = ChatOllama(
    model="gemma3:4b",
    temperature=0.2,
    num_predict=2048,
)