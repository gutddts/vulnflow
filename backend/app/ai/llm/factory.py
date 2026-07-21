"""LLM Provider Factory - creates the right provider from configuration."""

from __future__ import annotations

from typing import Any

from app.ai.llm.anthropic import AnthropicProvider
from app.ai.llm.base import BaseLLMProvider
from app.ai.llm.ollama import OllamaProvider
from app.ai.llm.openai import OpenAIProvider
from app.config import get_settings


class LLMProviderFactory:
    """Factory for creating LLM providers based on configuration.

    Supports:
        - openai / deepseek: OpenAI-compatible API
        - ollama: Local models via Ollama
        - anthropic: Claude models via Anthropic API
    """

    # Map provider names to their classes
    _providers: dict[str, type[BaseLLMProvider]] = {
        "openai": OpenAIProvider,
        "deepseek": OpenAIProvider,  # DeepSeek uses OpenAI-compatible API
        "ollama": OllamaProvider,
        "anthropic": AnthropicProvider,
    }

    @classmethod
    def create(
        cls,
        provider: str | None = None,
        model: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        temperature: float | None = None,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> BaseLLMProvider:
        """Create an LLM provider from the given parameters.

        Falls back to settings if parameters are not provided.

        Args:
            provider: LLM provider name (openai, deepseek, ollama, anthropic)
            model: Model name
            api_key: API key for the provider
            api_base: API base URL (for self-hosted or compatible APIs)
            temperature: Model temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            A BaseLLMProvider instance

        Raises:
            ValueError: If the provider is not supported
        """
        settings = get_settings()

        provider_name = provider or settings.LLM_PROVIDER
        model_name = model or settings.LLM_MODEL
        api_key_val = api_key or settings.LLM_API_KEY
        api_base_val = api_base or settings.LLM_API_BASE
        temperature_val = temperature if temperature is not None else 0.7

        provider_cls = cls._providers.get(provider_name)
        if provider_cls is None:
            supported = ", ".join(cls._providers.keys())
            raise ValueError(
                f"Unsupported LLM provider: {provider_name}. "
                f"Supported providers: {supported}"
            )

        if provider_name in ("openai", "deepseek"):
            return OpenAIProvider(
                model_name=model_name,
                api_key=api_key_val,
                api_base=api_base_val,
                temperature=temperature_val,
                max_tokens=max_tokens,
                **kwargs,
            )
        elif provider_name == "ollama":
            base_url = api_base_val or "http://localhost:11434"
            return OllamaProvider(
                model_name=model_name,
                base_url=base_url,
                temperature=temperature_val,
                **kwargs,
            )
        elif provider_name == "anthropic":
            return AnthropicProvider(
                model_name=model_name,
                api_key=api_key_val,
                temperature=temperature_val,
                max_tokens=max_tokens,
                **kwargs,
            )
        else:
            raise ValueError(f"Provider {provider_name} not implemented")

    @classmethod
    def create_from_agent_config(cls, agent_config: dict) -> BaseLLMProvider:
        """Create an LLM provider from an agent configuration dictionary.

        Args:
            agent_config: Dictionary with llm_provider, llm_model, config fields

        Returns:
            A BaseLLMProvider instance
        """
        return cls.create(
            provider=agent_config.get("llm_provider"),
            model=agent_config.get("llm_model"),
            api_key=agent_config.get("config", {}).get("api_key"),
            api_base=agent_config.get("config", {}).get("api_base"),
            temperature=agent_config.get("temperature"),
            max_tokens=agent_config.get("config", {}).get("max_tokens", 4096),
        )

    @classmethod
    def get_supported_providers(cls) -> list[str]:
        """Return a list of supported provider names."""
        return list(cls._providers.keys())
