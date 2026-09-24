# Monkeypatch PostgreSQL UUID and JSONB for SQLite compatibility
import sqlalchemy.dialects.postgresql as pg
from sqlalchemy import UUID, JSON
pg.UUID = UUID
pg.JSONB = JSON

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings
from app.core.data_mode import allows_demo_fallback
from app.core.logging_config import configure_logging, logger

configure_logging()


def _engine_options(url, *, worker: bool = False) -> dict:
    if url.drivername.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}, "echo": settings.debug_enabled}

    connect_args = {}
    if url.drivername.startswith("postgresql"):
        connect_args["connect_timeout"] = 8
        # The Supabase transaction pooler (port 6543) does not accept
        # session-level startup options (`options=-c ...`); sending them can
        # break pooled connections. Only set statement_timeout for direct
        # (non-pooled) connections.
        is_pooled = "pooler.supabase.com" in (url.host or "") or url.port == 6543
        if not is_pooled:
            connect_args["options"] = "-c statement_timeout=30000"

    if worker:
        pool_size = settings.DB_WORKER_POOL_SIZE
        max_overflow = settings.DB_WORKER_MAX_OVERFLOW
        pool_timeout = settings.DB_WORKER_POOL_TIMEOUT
    else:
        pool_size = settings.DB_POOL_SIZE
        max_overflow = settings.DB_MAX_OVERFLOW
        pool_timeout = settings.DB_POOL_TIMEOUT

    # Supabase transaction pooler (port 6543) has a hard connection cap
    # (default 15). Cap ALL pools below that so multiple AppSail instances plus
    # AI worker pools can never collectively overflow it — connection refusals
    # there surface as "postgresql: down" (and 503 storms) on a healthy DB.
    is_pooled = "pooler.supabase.com" in (url.host or "") or url.port == 6543
    if is_pooled:
        if worker:
            pool_size = min(pool_size, 2)
            max_overflow = min(max_overflow, 2)
            pool_timeout = max(pool_timeout, 300)
        else:
            # 3+3 per instance → two AppSail instances use ≤12 of the pooler's
            # 15-connection cap, so even a forgotten DB_POOL_SIZE env var can
            # never overflow the pooler (4+4 × 2 instances = 16 > 15 caused the
            # refusals seen as "postgresql: down").
            pool_size = min(pool_size, 3)
            max_overflow = min(max_overflow, 3)
            # Fail fast when the pool is saturated: requests that wait longer
            # than this get a clean 503 (+frontend auto-retry) instead of
            # hanging until AppSail's own execution-timeout kills them.
            pool_timeout = min(pool_timeout, 10)

    return {
        "pool_size": pool_size,
        "max_overflow": max_overflow,
        "pool_pre_ping": True,
        "pool_recycle": 120,
        "pool_timeout": pool_timeout,
        "connect_args": connect_args,
        "echo": settings.debug_enabled,
    }


def _create_engine(url=None, *, worker: bool = False) -> Engine:
    target_url = url or settings.DATABASE_URL
    return create_engine(target_url, **_engine_options(make_url(target_url), worker=worker))


def _try_connect(eng) -> bool:
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


engine = _create_engine()
engine_kind: str = "sqlite" if settings.DATABASE_URL.startswith("sqlite") else "postgresql"

if not settings.DATABASE_URL.startswith("sqlite") and not _try_connect(engine):
    if allows_demo_fallback():
        logger.warning(
            "PostgreSQL unreachable - falling back to local SQLite demo database. "
            "Real-time data will be unavailable until the DB is reachable."
        )
        engine.dispose()
        settings.DATABASE_URL = "sqlite:///./saksha.db"
        engine = _create_engine("sqlite:///./saksha.db")
        engine_kind = "sqlite"
    else:
        # Production/test must never silently serve an empty or stale local
        # database as if it were the configured Supabase project. Keep the
        # PostgreSQL engine so request paths return an honest database error
        # and can recover once the upstream connection is available.
        logger.error(
            "PostgreSQL unreachable in %s mode; keeping PostgreSQL engine and "
            "disabling local SQLite fallback.",
            settings.SAKSHA_DATA_MODE,
        )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dedicated worker pool for long-running background jobs (model training /
# retrain, parallel AI worker threads). Kept on a SEPARATE engine so heavy
# jobs hold those connections instead of the request-path ones — a saturated
# worker pool can never block auth/CRUD traffic (QueuePool TimeoutError).
# SQLite (demo/test) reuses the main engine to avoid file-lock contention.
_use_worker_pool = not settings.DATABASE_URL.startswith("sqlite")
worker_engine = _create_engine(worker=True) if _use_worker_pool else engine
WorkerSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=worker_engine)


def get_worker_session():
    """Return a DB session bound to the dedicated worker pool.

    Background/worker code (model training, retrain jobs, parallel AI worker
    threads that perform CPU-heavy inference while holding a session) must use
    this instead of ``SessionLocal()`` so the request-path pool stays free.
    """
    return WorkerSessionLocal()


class Base(DeclarativeBase):
    pass


def get_db() -> Generator:
    """FastAPI dependency that yields a DB session and guarantees it is closed."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
