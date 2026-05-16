FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml /app/pyproject.toml
RUN uv sync --no-install-project --no-dev

ADD . /app
RUN uv sync --no-dev

ENV PATH="/app/.venv/bin:$PATH"
ENTRYPOINT []
CMD ["uvicorn", "src.app.main:app", "--host", "0.0.0.0", "--port", "8002"]
