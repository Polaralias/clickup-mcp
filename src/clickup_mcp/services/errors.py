"""Shared error taxonomy for ClickUp MCP services."""

from __future__ import annotations

from typing import Any, Mapping, MutableMapping, Optional


class ClickUpServiceError(Exception):
    """Base exception used across ClickUp service layers."""

    def __init__(self, message: str, *, code: str = "UNKNOWN", context: Optional[Mapping[str, Any]] = None) -> None:
        super().__init__(message)
        self.code = code
        self.context: MutableMapping[str, Any] = dict(context or {})

    def to_dict(self) -> MutableMapping[str, Any]:
        """Return a serialisable dictionary representation of the error."""

        payload: MutableMapping[str, Any] = {"message": str(self), "code": self.code}
        if self.context:
            payload["context"] = dict(self.context)
        return payload


class InvalidParameterError(ClickUpServiceError):
    """Raised when the caller provides invalid or ambiguous input."""

    def __init__(self, message: str, *, context: Optional[Mapping[str, Any]] = None) -> None:
        super().__init__(message, code="INVALID_PARAMETER", context=context)


class NotFoundError(ClickUpServiceError):
    """Raised when a requested ClickUp resource cannot be located."""

    def __init__(self, message: str, *, context: Optional[Mapping[str, Any]] = None) -> None:
        super().__init__(message, code="NOT_FOUND", context=context)


class RateLimitError(ClickUpServiceError):
    """Raised when ClickUp signals a rate limiting condition."""

    def __init__(self, message: str, *, context: Optional[Mapping[str, Any]] = None) -> None:
        super().__init__(message, code="RATE_LIMIT", context=context)


class UnknownError(ClickUpServiceError):
    """Raised when the service encounters an unexpected failure."""

    def __init__(self, message: str, *, context: Optional[Mapping[str, Any]] = None) -> None:
        super().__init__(message, code="UNKNOWN", context=context)


__all__ = [
    "ClickUpServiceError",
    "InvalidParameterError",
    "NotFoundError",
    "RateLimitError",
    "UnknownError",
]
