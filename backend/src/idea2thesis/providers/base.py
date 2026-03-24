from __future__ import annotations

from typing import Protocol


class CompletionProvider(Protocol):
    def complete(self, prompt: str) -> str:
        """Return a model completion for the given prompt."""
