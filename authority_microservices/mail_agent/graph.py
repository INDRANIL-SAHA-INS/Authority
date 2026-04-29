from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from mail_agent.schema import AgentState
from mail_agent.nodes import extraction_node, resolve_targets, send_email_node

workflow = StateGraph(AgentState)
workflow.add_node("extraction_node", extraction_node)
workflow.add_node("resolve_targets", resolve_targets)
workflow.add_node("send_email_node", send_email_node)

workflow.add_edge(START, "extraction_node")
workflow.add_edge("extraction_node", "resolve_targets")
workflow.add_edge("resolve_targets", "send_email_node")
workflow.add_edge("send_email_node", END)


# memory = MemorySaver()
# graph = workflow.compile(checkpointer=memory)
# thread_id = "19"
# config = {"configurable": {"thread_id": thread_id}}

graph= workflow.compile()
