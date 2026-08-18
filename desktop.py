"""
Desktop launcher — the PyInstaller entry point (compressor_sim.spec).

Runs the existing FastAPI app (backend/app/server.py, unchanged) in a
background thread on an ephemeral localhost port, then opens a native
WebView2 window pointed at it. See docs' "Desktop packaging" notes for the
overall design (pywebview + PyInstaller, --onedir).

Windows-only: %LOCALAPPDATA%, WebView2 (gui="edgechromium"), and the
Windows stale-lock check below all assume Windows. This is the only
supported target (see README) — no Linux/macOS branches.
"""
import atexit
import ctypes
import logging
import os
import socket
import sys
import threading
import time
from logging.handlers import RotatingFileHandler

from backend import paths

log = logging.getLogger("compressor_sim.desktop")

# console=False (compressor_sim.spec) means there is no terminal, so
# sys.stdout/sys.stderr are None in the frozen build. Anything that writes
# to them unguarded (uvicorn's default logging config, a stray print) would
# crash with AttributeError: 'NoneType' object has no attribute 'write'.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")


def setup_logging() -> None:
    """console=False in the frozen build means there is no terminal to see
    tracebacks in — everything must go to a file, or a crash is
    undebuggable (packaging spec A5)."""
    handler = RotatingFileHandler(
        paths.log_dir() / "app.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(handler)


def _pid_alive(pid: int) -> bool:
    if sys.platform == "win32":
        h = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if h:
            ctypes.windll.kernel32.CloseHandle(h)
            return True
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def acquire_single_instance_lock() -> None:
    """Two copies of this app would mean two OPC UA clients writing the
    same PLC tags — nondeterministic PLC state. A lock file holding the
    owning PID (rather than a bare O_CREAT|O_EXCL marker) lets a *new*
    launch tell a leftover lock from a previous crash apart from a lock a
    still-running instance actually holds, so a crash doesn't permanently
    lock users out of the app."""
    lock_path = paths.user_data_dir() / "compressor_sim.lock"
    if lock_path.exists():
        try:
            owner_pid = int(lock_path.read_text().strip())
        except (ValueError, OSError):
            owner_pid = None
        if owner_pid is not None and owner_pid != os.getpid() and _pid_alive(owner_pid):
            log.warning("another instance is already running (pid %s), exiting", owner_pid)
            sys.exit(0)
        lock_path.unlink(missing_ok=True)  # stale, owner is gone
    lock_path.write_text(str(os.getpid()))
    atexit.register(lambda: lock_path.unlink(missing_ok=True))


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class BackendServer:
    """Runs uvicorn in this process's own thread rather than a subprocess
    — the app is single-process end to end, so the single-instance lock
    and window-close handling only ever have one thing to manage."""

    def __init__(self, port: int):
        import uvicorn
        from backend.app.server import app

        config = uvicorn.Config(
            app,
            host="127.0.0.1",
            port=port,
            log_level="warning",
            access_log=False,
            log_config=None,  # don't let uvicorn install its own stderr handler — setup_logging() already did
        )
        self.server = uvicorn.Server(config)

    def run(self) -> None:
        self.server.run()

    def stop(self) -> None:
        self.server.should_exit = True


def wait_for_port(port: int, timeout_s: float = 15.0) -> None:
    """Poll until the socket accepts a connection rather than sleeping a
    fixed guess — uvicorn startup time varies with disk speed (worse in a
    PyInstaller onedir build reading from an antivirus-scanned folder)."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            return
        except OSError:
            time.sleep(0.1)
    raise TimeoutError(f"backend did not start listening on port {port} within {timeout_s}s")


class TitlebarApi:
    """Exposed to the frontend as window.pywebview.api.* — backs the custom
    titlebar's minimize/maximize/restore/close buttons (restyle spec §9),
    since a frameless window has no native chrome to provide them."""

    window = None  # set once the real window exists, in main()

    def minimize(self) -> None:
        TitlebarApi.window.minimize()

    def maximize(self) -> None:
        TitlebarApi.window.maximize()

    def restore(self) -> None:
        TitlebarApi.window.restore()

    def close(self) -> None:
        TitlebarApi.window.destroy()


def fatal_message_box(text: str) -> None:
    if sys.platform == "win32":
        ctypes.windll.user32.MessageBoxW(0, text, "Compressor Simulator", 0x10)  # MB_ICONERROR
    else:
        print(text, file=sys.stderr)


def main() -> None:
    setup_logging()
    acquire_single_instance_lock()

    port = free_port()
    backend = BackendServer(port)
    threading.Thread(target=backend.run, daemon=True, name="uvicorn").start()

    try:
        wait_for_port(port)
    except TimeoutError:
        log.exception("backend failed to start")
        fatal_message_box(
            "Compressor Simulator's backend failed to start.\n"
            f"See the log at {paths.log_dir() / 'app.log'}"
        )
        sys.exit(1)

    try:
        import webview
    except Exception:
        log.exception("pywebview import failed")
        fatal_message_box(
            "Compressor Simulator could not start its window.\n"
            "This usually means the Microsoft Edge WebView2 Runtime is not "
            "installed. Run the bundled WebView2 installer, then relaunch."
        )
        sys.exit(1)

    # frameless + a custom in-page titlebar (App.tsx) — a stock Windows
    # title bar on a plant control HMI is an instant "this is a web app"
    # tell (restyle spec §9). easy_drag (default True) lets the titlebar
    # region drag the window without any JS drag-tracking code, and
    # pywebview already excludes real <button>/<input> elements from
    # initiating a drag, so the minimize/maximize/close buttons still work.
    window = webview.create_window(
        "Compressor Simulator — Ariel JGH/4",
        f"http://127.0.0.1:{port}",
        width=1600,
        height=980,
        min_size=(1280, 760),
        background_color="#C6C6C6",
        frameless=True,
        js_api=TitlebarApi(),
    )
    TitlebarApi.window = window
    window.events.closing += lambda: (backend.stop(), True)

    try:
        webview.start(
            gui="edgechromium",
            debug=False,
            private_mode=False,
            storage_path=str(paths.user_data_dir() / "webview"),
        )
    except Exception:
        log.exception("webview.start failed — WebView2 runtime likely missing")
        fatal_message_box(
            "Compressor Simulator could not start its window.\n"
            "This usually means the Microsoft Edge WebView2 Runtime is not "
            "installed. Run the bundled WebView2 installer, then relaunch."
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
