from langchain_core.messages import HumanMessage
from mail_agent.graph import graph

user_message = "Send email to students 1 attendance section 1 and subject id 4 "

output = graph.invoke(
    {"messages": [HumanMessage(content=user_message)]},
    
 )

print(output)