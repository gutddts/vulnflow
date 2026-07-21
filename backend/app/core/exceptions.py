"""Custom exception classes for consistent error responses."""

from __future__ import annotations

from typing import Any


class AppException(Exception):
    """Base application exception with HTTP status code."""

    status_code: int = 500
    message: str = "Internal server error"

    def __init__(self, message: str | None = None, detail: Any = None) -> None:
        self.message = message or self.message
        self.detail = detail
        super().__init__(self.message)


class NotFoundException(AppException):
    """Resource not found."""
    status_code = 404
    message = "Resource not found"


class UnauthorizedException(AppException):
    """Authentication required."""
    status_code = 401
    message = "Authentication required"


class ForbiddenException(AppException):
    """Insufficient permissions."""
    status_code = 403
    message = "Insufficient permissions"


class ValidationException(AppException):
    """Request validation error."""
    status_code = 422
    message = "Validation error"


class ConflictException(AppException):
    """Resource conflict (e.g., duplicate)."""
    status_code = 409
    message = "Resource conflict"


class BadRequestException(AppException):
    """Bad request."""
    status_code = 400
    message = "Bad request"


class ServiceUnavailableException(AppException):
    """External service unavailable."""
    status_code = 503
    message = "Service temporarily unavailable"


class RateLimitExceededException(AppException):
    """Too many requests."""
    status_code = 429
    message = "Rate limit exceeded"
