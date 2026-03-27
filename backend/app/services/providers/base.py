from dataclasses import dataclass


@dataclass
class ProviderStatus:
    id: str
    name: str
    kind: str
    available: bool
    logged_in: bool
    detail: str
    connected_account: str | None = None


def unavailable_status(provider_id: str, name: str, kind: str, detail: str) -> ProviderStatus:
    return ProviderStatus(
        id=provider_id,
        name=name,
        kind=kind,
        available=False,
        logged_in=False,
        detail=detail,
    )
