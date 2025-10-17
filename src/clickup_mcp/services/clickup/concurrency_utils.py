from __future__ import annotations

import asyncio
import inspect
import random
from dataclasses import asdict, dataclass, field
from typing import Any, Awaitable, Callable, Iterable, List, Mapping, MutableMapping, Optional, Sequence


class ClickUpServiceError(Exception):
    """Base exception used by the bulk ClickUp service layer."""

    def __init__(self, message: str, code: str = "UNKNOWN", context: Optional[Mapping[str, Any]] = None) -> None:
        super().__init__(message)
        self.code = code
        self.context: Mapping[str, Any] = dict(context or {})


@dataclass
class BatchResult:
    """Aggregate result returned from batch processors."""

    successful: List[Any] = field(default_factory=list)
    failed: List[MutableMapping[str, Any]] = field(default_factory=list)
    totals: MutableMapping[str, int] = field(default_factory=lambda: {"success": 0, "failure": 0, "total": 0})

    def to_dict(self) -> Mapping[str, Any]:
        """Return a JSON-serialisable representation."""

        return asdict(self)


@dataclass
class BatchOptions:
    """Runtime options controlling batch execution behaviour."""

    batch_size: int = 10
    concurrency: int = 3
    retry_count: int = 3
    retry_delay: float = 1.0
    exponential_backoff: bool = True
    continue_on_error: bool = True
    progress_callback: Optional[Callable[[Mapping[str, Any]], Awaitable[None] | None]] = None

    def merged(self, overrides: Optional[Mapping[str, Any]]) -> "BatchOptions":
        if not overrides:
            return self
        data = {
            "batch_size": max(1, int(overrides.get("batch_size", self.batch_size))),
            "concurrency": max(1, int(overrides.get("concurrency", self.concurrency))),
            "retry_count": max(0, int(overrides.get("retry_count", self.retry_count))),
            "retry_delay": max(0.0, float(overrides.get("retry_delay", self.retry_delay))),
            "exponential_backoff": bool(overrides.get("exponential_backoff", self.exponential_backoff)),
            "continue_on_error": bool(overrides.get("continue_on_error", self.continue_on_error)),
            "progress_callback": overrides.get("progress_callback", self.progress_callback),
        }
        return BatchOptions(**data)


async def _maybe_await(result: Awaitable[Any] | Any) -> Any:
    if inspect.isawaitable(result):
        return await result  # type: ignore[return-value]
    return result


def _chunked(items: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


async def _run_single(
    index: int,
    item: Any,
    processor: Callable[[Any], Awaitable[Any] | Any],
    semaphore: asyncio.Semaphore,
    options: BatchOptions,
) -> tuple[bool, Any | MutableMapping[str, Any]]:
    attempt = 0
    delay = options.retry_delay
    while True:
        try:
            async with semaphore:
                result = await _maybe_await(processor(item))
            return True, result
        except Exception as exc:  # pragma: no cover - exercised via explicit tests
            attempt += 1
            if attempt > options.retry_count:
                return False, {"item": item, "error": str(exc), "index": index}
            wait_delay = delay
            if options.exponential_backoff and delay > 0:
                wait_delay = delay * (2 ** (attempt - 1))
            jitter = random.uniform(0, wait_delay * 0.25) if wait_delay else 0.0
            await asyncio.sleep(wait_delay + jitter)


async def process_batch(
    items: Iterable[Any],
    processor: Callable[[Any], Awaitable[Any] | Any],
    options: Optional[Mapping[str, Any]] = None,
) -> BatchResult:
    """Process items using bounded concurrency and retry semantics."""

    materialised: List[Any] = list(items)
    result = BatchResult()
    result.totals.update({
        "success": 0,
        "failure": 0,
        "total": len(materialised),
    })
    if not materialised:
        return result

    opts = BatchOptions().merged(options)
    semaphore = asyncio.Semaphore(opts.concurrency)
    completed = 0

    async def emit_progress() -> None:
        if not opts.progress_callback:
            return
        payload = {
            "completed": completed,
            "success": result.totals["success"],
            "failure": result.totals["failure"],
            "total": result.totals["total"],
        }
        progress_result = opts.progress_callback(payload)
        if progress_result is not None:
            await _maybe_await(progress_result)

    halt = False
    for batch_index, batch in enumerate(_chunked(materialised, opts.batch_size), start=1):
        if halt:
            break
        tasks = [
            asyncio.create_task(_run_single(idx, item, processor, semaphore, opts))
            for idx, item in enumerate(batch, start=(batch_index - 1) * opts.batch_size)
        ]
        for outcome in await asyncio.gather(*tasks):
            success, payload = outcome
            completed += 1
            if success:
                result.successful.append(payload)
                result.totals["success"] += 1
            else:
                failure_entry = payload if isinstance(payload, MutableMapping) else {"error": str(payload), "index": completed - 1}
                result.failed.append(failure_entry)
                result.totals["failure"] += 1
                if not opts.continue_on_error:
                    halt = True
            await emit_progress()
            if halt:
                break

    if result.failed and not opts.continue_on_error:
        raise ClickUpServiceError(
            "Batch processing halted due to failure.",
            code="BATCH_ABORTED",
            context={
                "failed": list(result.failed),
                "successful": list(result.successful),
            },
        )

    return result
