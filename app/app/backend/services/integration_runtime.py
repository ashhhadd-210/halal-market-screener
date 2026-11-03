import threading
from copy import deepcopy

from core.config import settings


class IntegrationRuntime:
    def __init__(self):
        self._lock = threading.Lock()
        self._providers = {
            "massive": {
                "enabled": True,
                "api_key": settings.market_data_api_key,
                "api_key_required": True,
                "call_count": 0,
                "call_limit": None,
                "display_name": "Massive",
                "docs_url": settings.MARKET_DATA_PROVIDER_DOCS_URL,
            },
            "binance": {
                "enabled": True,
                "api_key": None,
                "api_key_required": False,
                "call_count": 0,
                "call_limit": None,
                "display_name": "Binance",
                "docs_url": settings.BINANCE_PROVIDER_DOCS_URL,
            },
            "stock_universe_cache": {
                "enabled": True,
                "api_key": None,
                "api_key_required": False,
                "call_count": 0,
                "call_limit": None,
            },
            "crypto_universe_cache": {
                "enabled": True,
                "api_key": None,
                "api_key_required": False,
                "call_count": 0,
                "call_limit": None,
            },
        }

    def _normalize_provider(self, provider_name: str):
        normalized = (provider_name or "").strip().lower()
        aliases = {
            "polygon": "massive",
            "polygonio": "massive",
            "polygon.io": "massive",
            "binance_spot": "binance",
        }
        return aliases.get(normalized, normalized)

    def _copy_provider_payload(self, provider):
        key = provider.get("api_key")
        key_set = bool((key or "").strip()) if isinstance(key, str) else bool(key)
        masked = ""
        if key_set and isinstance(key, str):
            cleaned = key.strip()
            if len(cleaned) <= 6:
                masked = "*" * len(cleaned)
            else:
                masked = f"{cleaned[:3]}...{cleaned[-3:]}"

        payload = {
            "enabled": bool(provider.get("enabled", False)),
            "api_key_set": key_set,
            "api_key_masked": masked,
            "api_key_required": bool(provider.get("api_key_required", False)),
            "call_count": int(provider.get("call_count", 0) or 0),
            "call_limit": provider.get("call_limit"),
            "display_name": provider.get("display_name"),
            "docs_url": provider.get("docs_url"),
        }
        return payload

    def snapshot(self):
        with self._lock:
            providers = {
                name: self._copy_provider_payload(provider)
                for name, provider in self._providers.items()
            }
        return {"providers": providers}

    def is_enabled(self, provider_name: str) -> bool:
        key = self._normalize_provider(provider_name)
        with self._lock:
            provider = self._providers.get(key)
            if not provider:
                return False
            return bool(provider.get("enabled", False))

    def update_provider(self, provider_name: str, enabled=None, api_key=None, call_limit=None):
        key = self._normalize_provider(provider_name)
        with self._lock:
            provider = self._providers.get(key)
            if provider is None:
                return False

            if enabled is not None:
                provider["enabled"] = bool(enabled)

            if api_key is not None:
                cleaned = str(api_key).strip()
                provider["api_key"] = cleaned or None

            if call_limit is not None:
                try:
                    parsed = int(call_limit)
                except Exception:
                    parsed = None
                provider["call_limit"] = parsed if parsed and parsed > 0 else None

            return True

    def record_call(self, provider_name: str, amount: int = 1):
        key = self._normalize_provider(provider_name)
        if amount <= 0:
            return

        with self._lock:
            provider = self._providers.get(key)
            if provider is None:
                return
            provider["call_count"] = int(provider.get("call_count", 0) or 0) + int(amount)

    def reset_call_counts(self):
        with self._lock:
            for provider in self._providers.values():
                provider["call_count"] = 0

    def diagnose(self, worker_status=None):
        checks = []

        with self._lock:
            providers = deepcopy(self._providers)

        for name, provider in providers.items():
            enabled = bool(provider.get("enabled", False))
            key = provider.get("api_key")
            key_set = bool((key or "").strip()) if isinstance(key, str) else bool(key)
            key_required = bool(provider.get("api_key_required", False))
            call_count = int(provider.get("call_count", 0) or 0)
            call_limit = provider.get("call_limit")

            status = "ok"
            message = f"{name} is {'enabled' if enabled else 'disabled'}."

            if enabled and key_required and not key_set:
                status = "warning"
                message = f"{name} is enabled but API key is missing."

            if enabled and call_limit and call_count >= int(call_limit):
                status = "warning"
                message = f"{name} reached its configured call limit ({call_count}/{call_limit})."

            checks.append(
                {
                    "name": f"integration:{name}",
                    "status": status,
                    "message": message,
                    "enabled": enabled,
                    "call_count": call_count,
                    "call_limit": call_limit,
                }
            )

        if worker_status is not None:
            running = bool(worker_status.get("running"))
            checks.append(
                {
                    "name": "worker",
                    "status": "ok" if running else "warning",
                    "message": "Market data worker is running." if running else "Market data worker is not running.",
                }
            )

        has_warning = any(check["status"] == "warning" for check in checks)
        overall = "degraded" if has_warning else "ok"
        return {
            "status": overall,
            "checks": checks,
        }


integration_runtime = IntegrationRuntime()
