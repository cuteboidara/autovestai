"""Minimal cached HTTP client with retry support for public market-data APIs."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import logging
from pathlib import Path
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import ActivationSettings


LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class CachedHttpClient:
    """Lightweight HTTP client with optional filesystem caching."""

    settings: ActivationSettings

    def get_json(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        cache_namespace: str | None = None,
        use_cache_on_error: bool = True,
    ) -> Any:
        """Fetch JSON payloads with retry/backoff and optional cache fallback."""

        payload = self.get_text(
            url,
            headers=headers,
            cache_namespace=cache_namespace,
            use_cache_on_error=use_cache_on_error,
        )
        return json.loads(payload)

    def get_text(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        cache_namespace: str | None = None,
        use_cache_on_error: bool = True,
    ) -> str:
        """Fetch text payloads with retry/backoff and optional cache fallback."""

        cache_path = self._cache_path(url, cache_namespace)
        request_headers = {
            "accept": "*/*",
            "user-agent": self.settings.user_agent,
            **(headers or {}),
        }

        last_error: Exception | None = None
        for attempt in range(1, self.settings.retry_attempts + 1):
            try:
                request = Request(url, headers=request_headers)
                with urlopen(request, timeout=self.settings.request_timeout_seconds) as response:
                    payload = response.read().decode("utf-8")
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(payload, encoding="utf-8")
                return payload
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
                last_error = error
                LOGGER.debug("HTTP fetch failed for %s on attempt %s: %s", url, attempt, error)
                if attempt < self.settings.retry_attempts:
                    time.sleep(self.settings.retry_backoff_seconds * attempt)

        if use_cache_on_error and cache_path.exists():
            LOGGER.warning("Using cached payload for %s after fetch failure", url)
            return cache_path.read_text(encoding="utf-8")

        if last_error is not None:
            raise last_error
        raise RuntimeError(f"Failed to fetch URL: {url}")

    def _cache_path(self, url: str, namespace: str | None) -> Path:
        safe_namespace = (namespace or "default").replace("/", "_")
        digest = hashlib.sha1(url.encode("utf-8")).hexdigest()
        return self.settings.cache_dir / safe_namespace / f"{digest}.cache"
