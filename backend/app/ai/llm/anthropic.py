"""Anthropic Claude LLM provider."""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel

from app.ai.llm.base import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider.

    Supports claude-3-opus, claude-3-5-sonnet, claude-3-haiku, etc.

    Requires: pip install langchain-anthropic
    """

    def __init__(
        self,
        model_name: str = "claude-3-5-sonnet-latest",
        api_key: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        streaming: bool = True,
    ) -> None:
        self._model_name = model_name
        self._api_key = api_key
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._streaming = streaming

    def get_chat_model(self) -> BaseChatModel:
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError:
            raise ImportError(
                "langchain-anthropic is required for Anthropic provider. "
                "Install it with: pip install langchain-anthropic"
            )
        return ChatAnthropic(
            model=self._model_name,
            api_key=self._api_key,
            temperature=self._temperature,
            max_tokens=self._max_tokens,
            streaming=self._streaming,
        )

    def get_model_name(self) -> str:
        return self._model_name

    @property
    def streaming(self) -> bool:
        return self._streaming
