"""Abstract base class for LLM providers."""

from __future__ import annotations

from abc import ABC, abstractmethod

from langchain_core.language_models import BaseChatModel


class BaseLLMProvider(ABC):
    """Abstract base for LLM providers.

    All LLM providers must implement get_chat_model() and get_model_name().
    """

    @abstractmethod
    def get_chat_model(self) -> BaseChatModel:
        """Return a LangChain-compatible chat model instance."""
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        """Return the model name string for this provider."""
        ...

    @property
    def streaming(self) -> bool:
        """Whether this provider supports streaming. Default True."""
        return True
