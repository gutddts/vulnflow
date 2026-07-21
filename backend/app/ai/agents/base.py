"""Base agent class for all VulnFlow agents."""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import Any

from langchain_core.language_models import BaseChatModel

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base class for all VulnFlow agents.

    Each agent:
        - Receives an LLM instance, tools list, and prompt templates
        - Implements run(state) to process the AgentState
        - Uses _log() for consistent logging
    """

    def __init__(
        self,
        llm: BaseChatModel,
        tools: list[Any] | None = None,
        prompts: dict[str, str] | None = None,
    ) -> None:
        self.llm = llm
        self.tools = tools or []
        self.prompts = prompts or {}
        self._agent_name = self.__class__.__name__

    @abstractmethod
    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        """Execute the agent's main logic.

        Args:
            state: The current AgentState dictionary

        Returns:
            Updated state fields as a dictionary (merged into AgentState)
        """
        ...

    def _log(self, message: str, level: str = "info", **kwargs: Any) -> None:
        """Log a message with agent context."""
        log_fn = getattr(logger, level, logger.info)
        log_fn(f"[{self._agent_name}] {message}", extra=kwargs)

    def _add_status(self, state: dict[str, Any], content: str) -> list[dict]:
        """Append a status message to the state's status_messages list."""
        messages = list(state.get("status_messages", []))
        messages.append({
            "type": "agent_message",
            "content": content,
            "agent": self._agent_name.lower().replace("agent", ""),
            "timestamp": time.time(),
        })
        return messages

    def _build_prompt(self, template_key: str, **kwargs: Any) -> str:
        """Build a prompt from a template with variable substitution.

        Args:
            template_key: Key in self.prompts dict
            **kwargs: Variables to substitute in the template

        Returns:
            Formatted prompt string
        """
        template = self.prompts.get(template_key, "")
        if not template:
            return ""
        try:
            return template.format(**kwargs)
        except KeyError as exc:
            self._log(f"Missing template variable: {exc}", "warning")
            return template

    @property
    def name(self) -> str:
        return self._agent_name
