import httpx

from idea2thesis.providers.openai_compatible import OpenAICompatibleProvider
from idea2thesis.providers.runner import (
    AgentProviderConfig,
    build_agent_provider_configs,
)
from idea2thesis.contracts import AgentRuntimeOverride, GlobalRuntimeConfig


def test_provider_returns_assistant_message() -> None:
    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={"choices": [{"message": {"content": "ok"}}]},
        )
    )
    provider = OpenAICompatibleProvider(
        base_url="https://example.com/v1",
        api_key="test-key",
        model="gpt-test",
        transport=transport,
    )
    assert provider.complete("hello") == "ok"


def test_build_agent_provider_configs_applies_agent_override_and_secret_fallback() -> None:
    configs = build_agent_provider_configs(
        resolved_configs={
            "advisor": GlobalRuntimeConfig(
                api_key="global-key",
                base_url="https://global.example/v1",
                model="gpt-global",
            ),
            "coder": GlobalRuntimeConfig(
                api_key="coder-effective",
                base_url="https://coder.example/v1",
                model="gpt-coder",
            ),
        },
        overrides={
            "coder": AgentRuntimeOverride(
                use_global=False,
                api_key="",
                base_url="https://coder.example/v1",
                model="gpt-coder",
            )
        },
        per_agent_api_keys={"coder": "coder-secret"},
    )

    assert configs["advisor"] == AgentProviderConfig(
        role="advisor",
        api_key="global-key",
        base_url="https://global.example/v1",
        model="gpt-global",
    )
    assert configs["coder"] == AgentProviderConfig(
        role="coder",
        api_key="coder-secret",
        base_url="https://coder.example/v1",
        model="gpt-coder",
    )
