# Gurukul timetable solver worker (CP-SAT over BullMQ).
# Build context: apps/solver only.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

COPY main.py pytest.ini ./
COPY solver/ solver/
COPY tests/ tests/

RUN useradd --create-home --shell /usr/sbin/nologin solver
USER solver

CMD ["python", "main.py"]
