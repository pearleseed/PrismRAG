import logging
import sys
import re
from rich.logging import RichHandler
from rich.console import Console
from rich.theme import Theme

# Professional theme for the terminal
custom_theme = Theme(
    {
        "logging.level.info": "cyan",
        "logging.level.warning": "yellow",
        "logging.level.error": "red bold",
        "logging.level.debug": "grey50",
    }
)

# Use a custom console with a wider layout
console = Console(theme=custom_theme, width=160)


class LogCleaner(logging.Filter):
    """
    Cleans up noisy log messages from third-party libraries.
    Removes common prefix clutter like '[]' from LightRAG.
    """

    def filter(self, record):
        if isinstance(record.msg, str):
            # Remove "[] " prefix often found in LightRAG/NanoGraphRAG
            record.msg = re.sub(r"^\[\]\s*", "", record.msg)
            # Remove extra spacing
            record.msg = record.msg.strip()
        return True


def setup_logging(log_level: str = "INFO"):
    """
    Aggressively intercepts all loggers to unify them under RichHandler.
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    # 1. Core Rich Handler
    rich_handler = RichHandler(
        console=console,
        rich_tracebacks=True,
        markup=True,
        show_path=True,
        omit_repeated_times=False,
    )
    rich_handler.addFilter(LogCleaner())

    # Global interceptor for record messages
    old_factory = logging.getLogRecordFactory()

    def record_factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        if isinstance(record.msg, str):
            # Global cleanup of common noise
            record.msg = re.sub(r"^\[\]\s*", "", record.msg)
            record.msg = record.msg.strip()
        return record

    logging.setLogRecordFactory(record_factory)

    # 2. Intercept root and all existing loggers
    logging.root.handlers = [rich_handler]
    logging.root.setLevel(level)

    # List of stubborn loggers to explicitly hijack
    target_loggers = [
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
        "starlette",
        "httpx",
        "lightrag",
        "nano-graphrag",
        "sqlalchemy",
        "watchfiles",
    ]

    for name in target_loggers:
        l = logging.getLogger(name)
        l.handlers = []
        l.propagate = True  # Let them bubble up to root's rich_handler
        l.setLevel(level)

    # 3. Handle uvicorn's internal logging configuration
    # Note: Uvicorn often resets logging in its worker/reloader processes.
    # We set these here to try and stay ahead.
    for name in ["uvicorn.access", "uvicorn.error"]:
        logger = logging.getLogger(name)
        logger.handlers = [rich_handler]
        logger.propagate = False

    # 4. Suppress very noisy logs even in INFO mode
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)

    root_logger = logging.getLogger()
    root_logger.info(
        f"🚀 [bold green]PrismRAG Logging System Active[/bold green] | Level: [bold cyan]{log_level}[/bold cyan]"
    )


def get_logger(name: str):
    return logging.getLogger(name)
