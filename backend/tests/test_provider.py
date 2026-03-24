import httpx

from idea2thesis.providers.openai_compatible import OpenAICompatibleProvider


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
