"""Schema metadata for ClickUp bulk MCP tools."""

from __future__ import annotations

BATCH_OPTIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "batch_size": {"type": "integer", "minimum": 1},
        "concurrency": {"type": "integer", "minimum": 1},
        "retry_count": {"type": "integer", "minimum": 0},
        "retry_delay": {"type": "number", "minimum": 0},
        "exponential_backoff": {"type": "boolean"},
        "continue_on_error": {"type": "boolean"},
    },
}

create_bulk_tasks_tool = {
    "name": "create_bulk_tasks",
    "description": "Create multiple ClickUp tasks concurrently within a list.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tasks": {"type": "array", "items": {"type": "object"}},
            "list_id": {"type": "string"},
            "list_name": {"type": "string"},
            "team_id": {"type": "integer"},
            "options": BATCH_OPTIONS_SCHEMA,
        },
        "required": ["tasks"],
    },
}

update_bulk_tasks_tool = {
    "name": "update_bulk_tasks",
    "description": "Update multiple ClickUp tasks concurrently.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tasks": {"type": "array", "items": {"type": "object"}},
            "team_id": {"type": "integer"},
            "options": BATCH_OPTIONS_SCHEMA,
        },
        "required": ["tasks"],
    },
}

move_bulk_tasks_tool = {
    "name": "move_bulk_tasks",
    "description": "Move multiple ClickUp tasks to a new list concurrently.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tasks": {"type": "array", "items": {"type": "object"}},
            "target_list_id": {"type": "string"},
            "target_list_name": {"type": "string"},
            "team_id": {"type": "integer"},
            "options": BATCH_OPTIONS_SCHEMA,
        },
        "required": ["tasks"],
    },
}

delete_bulk_tasks_tool = {
    "name": "delete_bulk_tasks",
    "description": "Delete multiple ClickUp tasks concurrently.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tasks": {"type": "array", "items": {"type": "object"}},
            "team_id": {"type": "integer"},
            "options": BATCH_OPTIONS_SCHEMA,
        },
        "required": ["tasks"],
    },
}

BULK_TOOLS = (
    create_bulk_tasks_tool,
    update_bulk_tasks_tool,
    move_bulk_tasks_tool,
    delete_bulk_tasks_tool,
)

__all__ = [
    "BATCH_OPTIONS_SCHEMA",
    "create_bulk_tasks_tool",
    "update_bulk_tasks_tool",
    "move_bulk_tasks_tool",
    "delete_bulk_tasks_tool",
    "BULK_TOOLS",
]
