from __future__ import annotations

import asyncio
import inspect
import logging
import re
import threading
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Optional, Sequence

from .utils import BatchResult, ClickUpServiceError, process_batch


@dataclass
class BulkTaskLookup:
    """Normalized identifier fields extracted from a task entry."""

    task_id: Optional[str]
    task_name: Optional[str]
    list_id: Optional[str]
    list_name: Optional[str]
    custom_task_id: Optional[str]


_STANDARD_TASK_ID_PATTERN = re.compile(r"^[0-9a-z]{7,12}$")


class BulkService:
    """High level service providing concurrent ClickUp task operations."""

    def __init__(
        self,
        client: Any,
        *,
        logger: Optional[logging.Logger] = None,
        batch_defaults: Optional[Mapping[str, Any]] = None,
    ) -> None:
        self._client = client
        self._logger = logger or logging.getLogger("clickup_mcp.bulk")
        self._batch_defaults: Mapping[str, Any] = dict(batch_defaults or {})

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def create_bulk_tasks(
        self,
        *,
        tasks: Sequence[Mapping[str, Any]],
        default_list_id: Optional[str] = None,
        default_list_name: Optional[str] = None,
        team_id: Optional[int] = None,
        options: Optional[Mapping[str, Any]] = None,
    ) -> BatchResult:
        resolved_team = self._ensure_team(team_id)
        resolved_default_list_id = self._resolve_default_list(default_list_id, default_list_name, resolved_team)
        entries = [dict(task) for task in tasks]

        async def processor(entry: Mapping[str, Any]) -> Mapping[str, Any]:
            return await asyncio.to_thread(
                self._create_task,
                entry,
                resolved_default_list_id,
                resolved_team,
            )

        prepared_options = self._prepare_options("create_bulk_tasks", options)
        result = _run_sync(process_batch(entries, processor, prepared_options))
        self._log_completion("create_bulk_tasks", result)
        return result

    def update_bulk_tasks(
        self,
        *,
        tasks: Sequence[Mapping[str, Any]],
        team_id: Optional[int] = None,
        options: Optional[Mapping[str, Any]] = None,
    ) -> BatchResult:
        resolved_team = self._ensure_team(team_id)
        entries = [dict(task) for task in tasks]

        async def processor(entry: Mapping[str, Any]) -> Mapping[str, Any]:
            return await asyncio.to_thread(
                self._update_task,
                entry,
                resolved_team,
            )

        prepared_options = self._prepare_options("update_bulk_tasks", options)
        result = _run_sync(process_batch(entries, processor, prepared_options))
        self._log_completion("update_bulk_tasks", result)
        return result

    def move_bulk_tasks(
        self,
        *,
        tasks: Sequence[Mapping[str, Any]],
        target_list_id: Optional[str] = None,
        target_list_name: Optional[str] = None,
        team_id: Optional[int] = None,
        options: Optional[Mapping[str, Any]] = None,
    ) -> BatchResult:
        resolved_team = self._ensure_team(team_id)
        resolved_target_list = self._resolve_default_list(target_list_id, target_list_name, resolved_team)
        if not resolved_target_list:
            raise ClickUpServiceError(
                "A destination list identifier or name must be supplied.",
                code="INVALID_PARAMETER",
            )
        entries = [dict(task) for task in tasks]

        async def processor(entry: Mapping[str, Any]) -> Mapping[str, Any]:
            return await asyncio.to_thread(
                self._move_task,
                entry,
                resolved_team,
                resolved_target_list,
            )

        prepared_options = self._prepare_options("move_bulk_tasks", options)
        result = _run_sync(process_batch(entries, processor, prepared_options))
        self._log_completion("move_bulk_tasks", result)
        return result

    def delete_bulk_tasks(
        self,
        *,
        tasks: Sequence[Mapping[str, Any]],
        team_id: Optional[int] = None,
        options: Optional[Mapping[str, Any]] = None,
    ) -> BatchResult:
        resolved_team = self._ensure_team(team_id)
        entries = [dict(task) for task in tasks]

        async def processor(entry: Mapping[str, Any]) -> Mapping[str, Any]:
            return await asyncio.to_thread(
                self._delete_task,
                entry,
                resolved_team,
            )

        prepared_options = self._prepare_options("delete_bulk_tasks", options)
        result = _run_sync(process_batch(entries, processor, prepared_options))
        self._log_completion("delete_bulk_tasks", result)
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _ensure_team(self, team_id: Optional[int]) -> Optional[int]:
        try:
            return self._client.ensure_team_id(team_id)
        except Exception as exc:  # pragma: no cover - defensive guard
            raise ClickUpServiceError(
                "Unable to determine ClickUp team identifier.",
                code="INVALID_PARAMETER",
                context={"team_id": team_id},
            ) from exc

    def _resolve_default_list(
        self,
        list_id: Optional[str],
        list_name: Optional[str],
        team_id: Optional[int],
    ) -> Optional[str]:
        if list_id:
            return str(list_id)
        if list_name:
            try:
                resolved = self._client.resolve_list_id(
                    team_id=team_id,
                    list_id=None,
                    list_name=list_name,
                )
            except Exception as exc:  # pragma: no cover - defensive guard
                raise ClickUpServiceError(
                    "Unable to resolve list name provided for bulk operation.",
                    code="NOT_FOUND",
                    context={"list_name": list_name},
                ) from exc
            return str(resolved)
        return None

    def _prepare_options(
        self,
        operation: str,
        options: Optional[Mapping[str, Any]],
    ) -> Mapping[str, Any]:
        merged: Dict[str, Any] = dict(self._batch_defaults)
        merged.update(options or {})
        user_callback = merged.get("progress_callback")

        async def _callback(progress: Mapping[str, Any]) -> Any:
            self._logger.debug(
                "%s progress",
                operation,
                extra={"operation": operation, **progress},
            )
            if user_callback:
                result = user_callback(progress)
                if inspect.isawaitable(result):
                    return await result
                return result
            return None

        merged["progress_callback"] = _callback
        return merged

    def _log_completion(self, operation: str, result: BatchResult) -> None:
        self._logger.info(
            "%s completed",
            operation,
            extra={
                "operation": operation,
                "success": result.totals.get("success", 0),
                "failure": result.totals.get("failure", 0),
                "total": result.totals.get("total", 0),
            },
        )

    def _create_task(
        self,
        entry: Mapping[str, Any],
        default_list_id: Optional[str],
        team_id: Optional[int],
    ) -> Mapping[str, Any]:
        list_id = self._resolve_list_for_entry(entry, default_list_id, team_id)
        payload = self._build_create_payload(entry)
        response = self._client.request_checked(
            "POST",
            f"/list/{list_id}/task",
            json_body=payload,
            team_id=team_id,
        )
        return response.to_jsonable()

    def _update_task(
        self,
        entry: Mapping[str, Any],
        team_id: Optional[int],
    ) -> Mapping[str, Any]:
        lookup = self._extract_lookup(entry)
        resolved_id, custom_id = self._resolve_task_identifier(lookup, team_id)
        payload = self._build_update_payload(entry)
        if not payload:
            raise ClickUpServiceError(
                "Task update entry did not include any fields to modify.",
                code="INVALID_PARAMETER",
                context={"item": dict(entry)},
            )
        query = self._build_task_query_params(resolved_id, custom_id, team_id)
        response = self._client.request_checked(
            "PUT",
            f"/task/{resolved_id}",
            json_body=payload,
            query_params=query or None,
            team_id=team_id,
        )
        return response.to_jsonable()

    def _move_task(
        self,
        entry: Mapping[str, Any],
        team_id: Optional[int],
        target_list_id: str,
    ) -> Mapping[str, Any]:
        lookup = self._extract_lookup(entry)
        resolved_id, custom_id = self._resolve_task_identifier(lookup, team_id)
        query = self._build_task_query_params(resolved_id, custom_id, team_id)
        payload = {"list_id": target_list_id}
        response = self._client.request_checked(
            "POST",
            f"/task/{resolved_id}/move",
            json_body=payload,
            query_params=query or None,
            team_id=team_id,
        )
        return response.to_jsonable()

    def _delete_task(
        self,
        entry: Mapping[str, Any],
        team_id: Optional[int],
    ) -> Mapping[str, Any]:
        lookup = self._extract_lookup(entry)
        resolved_id, custom_id = self._resolve_task_identifier(lookup, team_id)
        query = self._build_task_query_params(resolved_id, custom_id, team_id)
        response = self._client.request_checked(
            "DELETE",
            f"/task/{resolved_id}",
            query_params=query or None,
            team_id=team_id,
        )
        return response.to_jsonable()

    def _resolve_list_for_entry(
        self,
        entry: Mapping[str, Any],
        default_list_id: Optional[str],
        team_id: Optional[int],
    ) -> str:
        list_id = _coalesce_entry_value(entry, "listId", "list_id")
        if list_id:
            return str(list_id)
        list_name = _coalesce_entry_value(entry, "listName", "list_name")
        if list_name:
            resolved = self._client.resolve_list_id(
                team_id=team_id,
                list_id=None,
                list_name=list_name,
            )
            return str(resolved)
        if default_list_id:
            return str(default_list_id)
        raise ClickUpServiceError(
            "Each task must specify a list identifier when no default list is provided.",
            code="INVALID_PARAMETER",
            context={"item": dict(entry)},
        )

    def _extract_lookup(self, entry: Mapping[str, Any]) -> BulkTaskLookup:
        custom_task_id = _coalesce_entry_value(
            entry,
            "customTaskId",
            "custom_task_id",
            "customId",
            "custom_id",
        )
        task_id = _coalesce_entry_value(entry, "taskId", "task_id", "id")
        if not task_id and custom_task_id:
            task_id = custom_task_id
        return BulkTaskLookup(
            task_id=task_id,
            task_name=_coalesce_entry_value(entry, "taskName", "task_name"),
            list_id=_coalesce_entry_value(entry, "listId", "list_id"),
            list_name=_coalesce_entry_value(entry, "listName", "list_name"),
            custom_task_id=custom_task_id,
        )

    def _resolve_task_identifier(
        self,
        lookup: BulkTaskLookup,
        team_id: Optional[int],
    ) -> tuple[str, Optional[str]]:
        identifier = lookup.task_id
        if identifier and _is_standard_task_id(identifier):
            return str(identifier), lookup.custom_task_id

        list_id = lookup.list_id
        if not list_id and lookup.list_name:
            list_id = str(
                self._client.resolve_list_id(
                    team_id=team_id,
                    list_id=None,
                    list_name=lookup.list_name,
                )
            )

        if lookup.task_name or list_id or lookup.list_name or not identifier:
            resolved = self._client.resolve_task_id(
                team_id=team_id,
                task_id=identifier if identifier and _is_standard_task_id(str(identifier)) else None,
                task_name=lookup.task_name,
                list_id=list_id,
            )
            return str(resolved), lookup.custom_task_id

        if identifier:
            return str(identifier), lookup.custom_task_id

        raise ClickUpServiceError(
            "Task entry did not include enough information to identify the task.",
            code="INVALID_PARAMETER",
            context={"lookup": lookup.__dict__},
        )

    def _build_create_payload(self, entry: Mapping[str, Any]) -> Dict[str, Any]:
        name = _coalesce_entry_value(entry, "name")
        if not name:
            raise ClickUpServiceError(
                "Task creation entry requires a name field.",
                code="INVALID_PARAMETER",
                context={"item": dict(entry)},
            )
        payload: Dict[str, Any] = {"name": str(name)}
        self._assign_if_present(payload, entry, "description", "description")
        self._assign_if_present(payload, entry, "markdown_description", "markdown_description", "markdownDescription")
        self._assign_if_present(payload, entry, "status", "status")
        self._assign_if_present(payload, entry, "priority", "priority")
        self._assign_if_present(payload, entry, "parent", "parent")
        tags = _coalesce_entry_value(entry, "tags")
        if tags is not None:
            payload["tags"] = list(tags) if isinstance(tags, (list, tuple, set)) else tags
        assignees = _coalesce_entry_value(entry, "assignees")
        if assignees is not None:
            payload["assignees"] = list(assignees) if isinstance(assignees, (list, tuple, set)) else assignees
        self._assign_if_present(payload, entry, "due_date", "due_date", "dueDate")
        self._assign_if_present(payload, entry, "start_date", "start_date", "startDate")
        custom_id = _coalesce_entry_value(entry, "custom_task_id", "customTaskId", "customId", "custom_id")
        if custom_id:
            payload["custom_id"] = str(custom_id)
        notify_all = _coalesce_entry_value(entry, "notify_all", "notifyAll")
        if notify_all is not None:
            payload["notify_all"] = bool(notify_all)
        return payload

    def _assign_if_present(
        self,
        payload: MutableMapping[str, Any],
        entry: Mapping[str, Any],
        target_key: str,
        *source_keys: str,
    ) -> None:
        value = _coalesce_entry_value(entry, *source_keys)
        if value is not None:
            payload[target_key] = value

    def _build_update_payload(self, entry: Mapping[str, Any]) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        for target, sources in (
            ("name", ("name",)),
            ("description", ("description",)),
            ("markdown_description", ("markdown_description", "markdownDescription")),
            ("status", ("status",)),
            ("priority", ("priority",)),
            ("tags", ("tags",)),
            ("assignees", ("assignees",)),
            ("due_date", ("due_date", "dueDate")),
            ("start_date", ("start_date", "startDate")),
        ):
            value = _coalesce_entry_value(entry, *sources)
            if value is not None:
                payload[target] = list(value) if target in {"tags", "assignees"} and isinstance(value, (set, tuple)) else value
        return payload

    def _build_task_query_params(
        self,
        resolved_task_id: str,
        custom_task_id: Optional[str],
        team_id: Optional[int],
    ) -> Dict[str, Any]:
        query: Dict[str, Any] = {}
        use_custom = custom_task_id is not None or not _is_standard_task_id(resolved_task_id)
        if use_custom:
            query["custom_task_ids"] = "true"
        try:
            resolved_team = self._client.ensure_team_id(team_id)
        except Exception:
            resolved_team = None
        if resolved_team is not None and (use_custom or getattr(self._client, "uses_oauth_authentication", lambda: False)()):
            query["team_id"] = resolved_team
        return query


def _run_sync(coro: Any) -> Any:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    result: Dict[str, Any] = {}
    error: list[BaseException] = []

    def _runner() -> None:
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        try:
            result["value"] = new_loop.run_until_complete(coro)
        except BaseException as exc:  # pragma: no cover - defensive guard
            error.append(exc)
        finally:
            new_loop.close()

    thread = threading.Thread(target=_runner)
    thread.start()
    thread.join()
    if error:
        raise error[0]
    return result.get("value")


def _coalesce_entry_value(entry: Mapping[str, Any], *keys: str) -> Optional[Any]:
    for key in keys:
        if key in entry:
            value = entry[key]
            if value not in (None, ""):
                return value
    return None


def _is_standard_task_id(task_id: str) -> bool:
    if not isinstance(task_id, str):
        return False
    normalized = task_id.strip()
    if not normalized:
        return False
    return bool(_STANDARD_TASK_ID_PATTERN.fullmatch(normalized))
