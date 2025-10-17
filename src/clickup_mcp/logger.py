"""Logging utilities for the ClickUp MCP server."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

_DEFAULT_LEVEL = logging.INFO


class StructuredLogFormatter(logging.Formatter):
    """Render log records as JSON for easier ingestion."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401 - standard override
        payload: Dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
        }
        if record.msg:
            payload["message"] = record.getMessage()
        for key, value in record.__dict__.items():
            if key.startswith("_") or key in {
                "args",
                "created",
                "exc_info",
                "exc_text",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "msg",
                "name",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "stack_info",
                "thread",
                "threadName",
            }:
                continue
            payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def get_logger(name: str) -> logging.Logger:
    """Return a structured logger with sane defaults."""

    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredLogFormatter())
        logger.addHandler(handler)
        logger.setLevel(_DEFAULT_LEVEL)
        logger.propagate = False
    return logger


def set_level(level: int | str) -> None:
    """Adjust the global logging level for the ClickUp package."""

    logging.getLogger("clickup_mcp").setLevel(level)
