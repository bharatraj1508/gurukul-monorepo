# Timetable Solver Worker

Python worker that consumes `solve-timetable` jobs from the `timetable-solver`
BullMQ queue (Redis) and solves them with Google OR-Tools CP-SAT. The Nest API
is the only producer; this worker is the queue's only consumer. The job
payload/result contract is defined in
`apps/api/src/timetables/solver/timetable-solver.contracts.ts` and mirrored in
`solver/contracts.py` (schemaVersion 1).

INFEASIBLE is returned as a _successful_ job result (status `INFEASIBLE` with
actionable `infeasibleHints`); the worker only throws on invalid payloads or
infrastructure errors.

## Environment

| Variable                    | Default     | Purpose                                                             |
| --------------------------- | ----------- | ------------------------------------------------------------------- |
| `REDIS_HOST`                | `localhost` | Redis host                                                          |
| `REDIS_PORT`                | `6379`      | Redis port                                                          |
| `SOLVER_TIME_LIMIT_SECONDS` | `300`       | Cap on per-job solve wall time (payload limits are clamped to this) |
| `LOG_LEVEL`                 | `INFO`      | Python logging level                                                |

## Run locally

```sh
cd apps/solver
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python main.py   # requires Redis running (docker compose up redis)
```

## Tests

```sh
.venv/bin/pytest
```

No `package.json` here on purpose — this directory is invisible to yarn/turbo
and is built/run via its own Dockerfile (`python:3.12-slim`).
