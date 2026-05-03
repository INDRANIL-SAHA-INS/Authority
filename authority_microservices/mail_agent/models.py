from langchain_community.chat_models import ChatOllama

llm = ChatOllama(
    model="gemma3:4b",    
    temperature=0.3
)