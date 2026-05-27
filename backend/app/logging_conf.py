"""日志配置。

在应用启动时调用一次 setup_logging()，统一格式与级别。
"""

import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    """配置根 logger，输出到 stdout。

    同时把 uvicorn 自带的 logger 接到同一套格式，避免双重输出。
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(log_level)

    # uvicorn 的 access / error logger 复用上面的 handler
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uv_logger = logging.getLogger(name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True
