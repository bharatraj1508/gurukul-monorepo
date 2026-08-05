"""BullMQ worker entrypoint for the timetable CP-SAT solver.

Consumes 'solve-timetable' jobs from the 'timetable-solver' queue (produced by
the Nest API) and returns a SolverResult dict as the job return value.

Environment:
  REDIS_HOST                 Redis host (default: localhost)
  REDIS_PORT                 Redis port (default: 6379)
  SOLVER_TIME_LIMIT_SECONDS  Cap on per-job solve wall time (default: 300)
  LOG_LEVEL                  Python logging level (default: INFO)
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal

from bullmq import Worker

from solver.constants import (
    SOLVER_MAX_TIME_LIMIT_SECONDS,
    TIMETABLE_SOLVER_JOB,
    TIMETABLE_SOLVER_QUEUE,
)
from solver.contracts import PayloadValidationError, parse_payload
from solver.model import solve

logger = logging.getLogger("solver.worker")


def _env_time_limit_cap() -> float:
    raw = os.environ.get("SOLVER_TIME_LIMIT_SECONDS")
    if raw is None:
        return float(SOLVER_MAX_TIME_LIMIT_SECONDS)
    try:
        value = float(raw)
    except ValueError:
        logger.warning("invalid SOLVER_TIME_LIMIT_SECONDS=%r; using %s", raw, SOLVER_MAX_TIME_LIMIT_SECONDS)
        return float(SOLVER_MAX_TIME_LIMIT_SECONDS)
    return max(1.0, min(value, float(SOLVER_MAX_TIME_LIMIT_SECONDS)))


async def process(job, job_token):
    """Job processor. Raises only on invalid payloads or infrastructure
    errors; solver-side problems (including INFEASIBLE) come back as a
    successful job with the corresponding result status."""
    if job.name != TIMETABLE_SOLVER_JOB:
        raise ValueError(f"Unexpected job name {job.name!r}; expected {TIMETABLE_SOLVER_JOB!r}")

    try:
        payload = parse_payload(job.data)
    except PayloadValidationError as exc:
        logger.error("job=%s invalid payload: %s", job.id, exc)
        raise

    logger.info(
        "job=%s timetableId=%s classes=%d lessons=%d started",
        job.id,
        payload.timetableId,
        len(payload.classes),
        len(payload.lessons),
    )
    await job.updateProgress(10)

    time_limit = min(payload.limits.timeLimitSeconds, _env_time_limit_cap())
    await job.updateProgress(30)

    # Run CP-SAT off the event loop so BullMQ lock renewal keeps ticking
    # during long solves (a blocked loop would stall the job and retry it).
    result = await asyncio.to_thread(solve, payload, time_limit)
    await job.updateProgress(90)

    logger.info(
        "job=%s timetableId=%s status=%s slots=%d violations=%d hints=%d",
        job.id,
        payload.timetableId,
        result.status,
        len(result.slots),
        len(result.violations),
        len(result.infeasibleHints),
    )
    return result.to_dict()


async def main() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    redis_host = os.environ.get("REDIS_HOST", "localhost")
    redis_port = os.environ.get("REDIS_PORT", "6379")
    redis_url = f"redis://{redis_host}:{redis_port}"

    worker = Worker(
        TIMETABLE_SOLVER_QUEUE,
        process,
        {"connection": redis_url, "concurrency": 1},
    )
    logger.info(
        "worker started queue=%s redis=%s timeLimitCap=%ss",
        TIMETABLE_SOLVER_QUEUE,
        redis_url,
        _env_time_limit_cap(),
    )

    shutdown = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, shutdown.set)

    await shutdown.wait()
    logger.info("shutdown signal received; closing worker")
    await worker.close()
    logger.info("worker closed")


if __name__ == "__main__":
    asyncio.run(main())
