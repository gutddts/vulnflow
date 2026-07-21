"""OpenAI LLM provider (also compatible with DeepSeek API)."""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel

from app.ai.llm.base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    """OpenAI-compatible LLM provider.

    Works with OpenAI, DeepSeek, and any OpenAI-compatible API.
    """

    def __init__(
        self,
        model_name: str = "gpt-4o",
        api_key: str = "",
        api_base: str = "",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        streaming: bool = True,
    ) -> None:
        self._model_name = model_name
        self._api_key = api_key
        self._api_base = api_base
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._streaming = streaming

    def get_chat_model(self) -> BaseChatModel:
        try:
            from langchain_openai import ChatOpenAI
        except ImportError:
            raise ImportError(
                "langchain-openai is required for OpenAI/DeepSeek provider. "
                "Install it with: pip install langchain-openai"
            )
        kwargs: dict = {
            "model": self._model_name,
            "temperature": self._temperature,
            "max_tokens": self._max_tokens,
            "streaming": self._streaming,
        }
        if self._api_key:
            kwargs["api_key"] = self._api_key
        if self._api_base:
            kwargs["base_url"] = self._api_base
        return ChatOpenAI(**kwargs)

    def get_model_name(self) -> str:
        return self._model_name

    @property
    def streaming(self) -> bool:
        return self._streaming
