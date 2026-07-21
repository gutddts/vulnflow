"""Ollama LLM provider for local models."""

from __future__ import annotations

from langchain_core.language_models import BaseChatModel

from app.ai.llm.base import BaseLLMProvider


class OllamaProvider(BaseLLMProvider):
    """Ollama provider for locally hosted models.

    Supports models like llama3, qwen2, mistral, deepseek-r1, etc.
    """

    def __init__(
        self,
        model_name: str = "llama3",
        base_url: str = "http://localhost:11434",
        temperature: float = 0.7,
        num_predict: int = 4096,
        streaming: bool = True,
    ) -> None:
        self._model_name = model_name
        self._base_url = base_url
        self._temperature = temperature
        self._num_predict = num_predict
        self._streaming = streaming

    def get_chat_model(self) -> BaseChatModel:
        try:
            from langchain_ollama import ChatOllama
        except ImportError:
            raise ImportError(
                "langchain-ollama is required for Ollama provider. "
                "Install it with: pip install langchain-ollama"
            )
        return ChatOllama(
            model=self._model_name,
            base_url=self._base_url,
            temperature=self._temperature,
            num_predict=self._num_predict,
        )

    def get_model_name(self) -> str:
        return f"ollama:{self._model_name}"

    @property
    def streaming(self) -> bool:
        return self._streaming
