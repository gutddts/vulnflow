"""Conditional edge routing for the VulnFlow agent graph."""

from __future__ import annotations

from typing import Literal

from app.ai.graph.state import AgentState


def decide_next_action(state: AgentState) -> Literal["planner", "reporter"]:
    """Decide the next node after evaluator.

    Rules:
        - If there's an error: route to "reporter" (graceful termination)
        - If should_continue AND iteration < max_iterations: route to "planner"
        - Otherwise: route to "reporter"

    Args:
        state: Current AgentState

    Returns:
        Next node name: "planner" or "reporter"
    """
    # Error path: terminate gracefully by generating a report with errors
    if state.get("error"):
        return "reporter"

    should_continue = state.get("should_continue", False)
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", 5)

    if should_continue and iteration < max_iterations:
        return "planner"

    return "reporter"
