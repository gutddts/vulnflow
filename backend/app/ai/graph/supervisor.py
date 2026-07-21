"""Build the complete LangGraph StateGraph for VulnFlow.

Workflow:
    planner -> executor -> analyzer -> evaluator
                                         |
                              +---------+---------+
                              |                   |
                          planner (loop)     reporter -> END
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.ai.graph.edges import decide_next_action
from app.ai.graph.nodes import (
    analyzer_node,
    evaluator_node,
    executor_node,
    planner_node,
    reporter_node,
)
from app.ai.graph.state import AgentState


def build_workflow() -> StateGraph:
    """Build and compile the complete VulnFlow agent workflow graph.

    Returns:
        A compiled StateGraph ready for invocation or streaming.
    """
    workflow = StateGraph(AgentState)

    # Add all nodes
    workflow.add_node("planner", planner_node)
    workflow.add_node("executor", executor_node)
    workflow.add_node("analyzer", analyzer_node)
    workflow.add_node("evaluator", evaluator_node)
    workflow.add_node("reporter", reporter_node)

    # Set entry point
    workflow.set_entry_point("planner")

    # Linear edges: planner -> executor -> analyzer -> evaluator
    workflow.add_edge("planner", "executor")
    workflow.add_edge("executor", "analyzer")
    workflow.add_edge("analyzer", "evaluator")

    # Conditional branching from evaluator
    workflow.add_conditional_edges(
        "evaluator",
        decide_next_action,
        {
            "planner": "planner",
            "reporter": "reporter",
        },
    )

    # Reporter always ends the workflow
    workflow.add_edge("reporter", END)

    return workflow.compile()
