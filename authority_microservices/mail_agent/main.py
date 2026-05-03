from langchain_core.messages import HumanMessage
from mail_agent.graph import graph
from mail_agent.schema import SubjectContext

# The teacher now only needs to mention the Subject Name
user_message = "Send attendance alert for Artificial Intelligence"

# The context provided by the app (mapping names to IDs)
context = [
    SubjectContext(
        subject_name="Artificial Intelligence",
        subject_id="6",
        section_name="BCA - Section A",
        section_id="1",
        batch_name="BCA Batch 2024"
    ),
    SubjectContext(
        subject_name="Cloud Computing",
        subject_id="7",
        section_name="BCA - Section A",
        section_id="1",
        batch_name="BCA Batch 2024"
    )
]

output = graph.invoke({
    "messages": [HumanMessage(content=user_message)],
    "context": context
})

print("--- AGENT OUTPUT ---")
print(f"Status: {output.get('status')}")
if "query_intent" in output:
    print(f"Extracted Intent: {output['query_intent']}")