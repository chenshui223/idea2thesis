from __future__ import annotations

from dataclasses import dataclass

from idea2thesis.contracts import AgentRuntimeOverride, GlobalRuntimeConfig
from idea2thesis.providers.base import CompletionProvider
from idea2thesis.providers.openai_compatible import OpenAICompatibleProvider


@dataclass(eq=True)
class AgentProviderConfig:
    role: str
    api_key: str
    base_url: str
    model: str


def build_agent_provider_configs(
    *,
    resolved_configs: dict[str, GlobalRuntimeConfig],
    overrides: dict[str, AgentRuntimeOverride],
    per_agent_api_keys: dict[str, str],
) -> dict[str, AgentProviderConfig]:
    configs: dict[str, AgentProviderConfig] = {}
    for role, resolved in resolved_configs.items():
        override = overrides.get(role, AgentRuntimeOverride())
        api_key = (
            per_agent_api_keys.get(role, "").strip()
            if not override.use_global
            else resolved.api_key
        ) or resolved.api_key
        configs[role] = AgentProviderConfig(
            role=role,
            api_key=api_key,
            base_url=resolved.base_url,
            model=resolved.model,
        )
    return configs


def build_completion_provider(config: AgentProviderConfig) -> CompletionProvider:
    return OpenAICompatibleProvider(
        base_url=config.base_url,
        api_key=config.api_key,
        model=config.model,
    )
