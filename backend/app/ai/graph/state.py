"""AgentState TypedDict for the VulnFlow multi-agent graph."""

from __future__ import annotations

from typing import Annotated, Any, Optional

from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class AgentState(TypedDict):
    """State shared across all agents in the LangGraph workflow.

    Fields are annotated with reducers where appropriate. The `messages` field
    uses `add_messages` so that each node appends rather than overwrites.
    """

    # ------------------------------------------------------------------ #
    #  Message history (annotated with add_messages reducer)
    # ------------------------------------------------------------------ #
    messages: Annotated[list[Any], add_messages]

    # ------------------------------------------------------------------ #
    #  Target information
    # ------------------------------------------------------------------ #
    target_url: str
    target_description: str
    project_id: Optional[str]
    task_id: Optional[str]
    session_id: Optional[str]

    # ------------------------------------------------------------------ #
    #  Planning state
    # ------------------------------------------------------------------ #
    attack_plan: dict  # {phases: [...], current_phase: int, methodology: str}
    selected_skills: list[str]  # List of skill IDs selected for current phase
    workflow_dag: dict  # {nodes: [...], edges: [...]}

    # ------------------------------------------------------------------ #
    #  Execution state
    # ------------------------------------------------------------------ #
    execution_results: dict  # {skill_id: {success, output, error, duration}}
    current_step: str  # Current step description
    tool_calls: list[dict]  # Pending tool call records

    # ------------------------------------------------------------------ #
    #  Analysis state
    # ------------------------------------------------------------------ #
    findings: list[dict]  # [{title, description, severity, cwe_id, evidence, ...}]
    evidence: list[dict]  # [{type, url, payload, screenshot, description}]
    sensitive_clues: list[dict]  # Clues from dongxuan-inspired sensitive data detection

    # ------------------------------------------------------------------ #
    #  Evaluation state
    # ------------------------------------------------------------------ #
    risk_score: float  # Overall risk score (0-100)
    severity_distribution: dict  # {critical, high, medium, low, info: count}
    should_continue: bool  # Whether to continue with another iteration
    next_action: str  # Recommended next action

    # ------------------------------------------------------------------ #
    #  Report state
    # ------------------------------------------------------------------ #
    report_data: dict  # Structured report data
    report_id: Optional[str]  # ID of generated report

    # ------------------------------------------------------------------ #
    #  Control state
    # ------------------------------------------------------------------ #
    error: str  # Error message if any step failed
    iteration: int  # Current iteration counter
    max_iterations: int  # Maximum allowed iterations
    mode: str  # Execution mode: "auto", "semi", or "review"

    # ------------------------------------------------------------------ #
    #  Streaming state
    # ------------------------------------------------------------------ #
    status_messages: list[dict]  # [{type, content, timestamp}] for SSE streaming
