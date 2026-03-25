from idea2thesis.contracts import (
    AgentRuntimeOverride,
    JobRuntimeConfig,
    PersistedSettings,
)


def test_runtime_config_round_trip_uses_global_alias() -> None:
    config = JobRuntimeConfig.model_validate(
        {
            "schema_version": "v1alpha1",
            "global": {
                "api_key": "runtime-key",
                "base_url": "https://example.com/v1",
                "model": "gpt-test",
            },
            "agents": {
                "coder": {
                    "use_global": False,
                    "api_key": "",
                    "base_url": "https://override.example/v1",
                    "model": "gpt-coder",
                }
            },
        }
    )

    assert config.global_config.base_url == "https://example.com/v1"
    assert config.agents["coder"] == AgentRuntimeOverride(
        use_global=False,
        api_key="",
        base_url="https://override.example/v1",
        model="gpt-coder",
    )
    assert config.model_dump(by_alias=True)["global"]["model"] == "gpt-test"


def test_persisted_settings_serialization_excludes_api_keys() -> None:
    settings = PersistedSettings.model_validate(
        {
            "schema_version": "v1alpha1",
            "global": {
                "base_url": "https://example.com/v1",
                "model": "gpt-test",
            },
            "agents": {
                "writer": {
                    "use_global": False,
                    "base_url": "https://writer.example/v1",
                    "model": "gpt-writer",
                }
            },
        }
    )

    payload = settings.model_dump_json(by_alias=True)
    assert '"api_key"' not in payload
    assert '"global"' in payload
