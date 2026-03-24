from __future__ import annotations

from dataclasses import dataclass

import httpx


@dataclass
class OpenAICompatibleProvider:
    base_url: str
    api_key: str
    model: str
    organization: str | None = None
    transport: httpx.BaseTransport | None = None

    def complete(self, prompt: str) -> str:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if self.organization:
            headers["OpenAI-Organization"] = self.organization

        with httpx.Client(
            base_url=self.base_url,
            transport=self.transport,
            timeout=30.0,
        ) as client:
            response = client.post(
                "/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
