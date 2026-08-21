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
from ctypes import wintypes
from logging.handlers import RotatingFileHandler

from backend import paths

log = logging.getLogger("compressor_sim.desktop")


def _set_per_monitor_dpi_awareness() -> None:
    """Make this process Per-Monitor-DPI-Aware v2 — the root fix for the
    window mis-sizing / "maximize jumps back to the other screen" bug on a
    multi-monitor setup where the screens run at different scale factors
    (e.g. 125% + 150%).

    pywebview calls the old SetProcessDPIAware(), which is only *system*-DPI
    aware: Windows then silently virtualizes (fakes) coordinates for any
    monitor whose DPI differs from the primary's, so GetWindowRect /
    MonitorFromWindow / SetWindowPos disagree about where a window actually
    is — that's why maximize picked the wrong monitor. Per-Monitor v2 turns
    that virtualization off, so every Win32 coordinate is real and
    consistent on every monitor.

    Awareness is process-global and only the FIRST setter in the process
    wins, so this must run at import time, before pywebview is imported and
    calls its weaker version. Falls back through older APIs on pre-1703
    Windows."""
    if sys.platform != "win32":
        return
    try:
        # DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 == handle value -4
        user32 = ctypes.windll.user32
        user32.SetProcessDpiAwarenessContext.restype = ctypes.c_int
        user32.SetProcessDpiAwarenessContext.argtypes = [ctypes.c_void_p]
        if user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4)):
            return
    except (AttributeError, OSError):
        pass
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
        return
    except (AttributeError, OSError):
        pass
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except (AttributeError, OSError):
        pass


_set_per_monitor_dpi_awareness()


# ---- Native window sizing (Win32) --------------------------------------
# The maximize/restore below deliberately use raw Win32 GetWindowRect /
# GetMonitorInfo / SetWindowPos instead of pywebview's window.resize()/
# .move()/.x/.width. pywebview's helpers work in *logical* (DPI-scaled)
# coordinates and resize() re-applies a scale factor — mixing those with a
# monitor work-area rectangle produced a wrong size, badly so across two
# monitors at different DPIs (e.g. a 1585x844 window on a 1920x1008
# monitor). GetWindowRect and SetWindowPos both operate in the *same*
# physical-pixel space, so reading the monitor's work area and writing it
# straight back can't disagree — no scale-factor guesswork.
if sys.platform == "win32":
    _user32 = ctypes.windll.user32

    class _MONITORINFO(ctypes.Structure):
        _fields_ = [
            ("cbSize", wintypes.DWORD),
            ("rcMonitor", wintypes.RECT),
            ("rcWork", wintypes.RECT),
            ("dwFlags", wintypes.DWORD),
        ]

    # Explicit arg/restypes: handles are 64-bit pointers on x64; without
    # this ctypes assumes c_int returns and truncates them, silently
    # breaking MonitorFromWindow.
    _user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    _user32.GetWindowRect.restype = wintypes.BOOL
    _user32.MonitorFromWindow.argtypes = [wintypes.HWND, wintypes.DWORD]
    _user32.MonitorFromWindow.restype = ctypes.c_void_p
    _user32.GetMonitorInfoW.argtypes = [ctypes.c_void_p, ctypes.POINTER(_MONITORINFO)]
    _user32.GetMonitorInfoW.restype = wintypes.BOOL
    _user32.SetWindowPos.argtypes = [
        wintypes.HWND, wintypes.HWND,
        ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT,
    ]
    _user32.SetWindowPos.restype = wintypes.BOOL
    _user32.GetDpiForWindow.argtypes = [wintypes.HWND]
    _user32.GetDpiForWindow.restype = wintypes.UINT


def _window_dpi_scale(hwnd: int) -> float:
    """Physical-per-CSS-pixel ratio for the window's current monitor (1.0 at
    96 DPI, 1.25 at 120 DPI, ...). Browser mouse screenX/screenY arrive in
    CSS pixels; SetWindowPos works in physical pixels, so a drag delta must
    be multiplied by this to track the cursor 1:1."""
    try:
        return _user32.GetDpiForWindow(wintypes.HWND(hwnd)) / 96.0
    except Exception:
        return 1.0


def _get_window_rect(hwnd: int):
    """(left, top, right, bottom) of the window in physical pixels."""
    r = wintypes.RECT()
    _user32.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(r))
    return (r.left, r.top, r.right, r.bottom)


def _monitor_work_area(hwnd: int):
    """(left, top, right, bottom) work area — screen minus taskbar — of the
    monitor the window is currently on, in physical pixels."""
    MONITOR_DEFAULTTONEAREST = 2
    hmon = _user32.MonitorFromWindow(wintypes.HWND(hwnd), MONITOR_DEFAULTTONEAREST)
    mi = _MONITORINFO()
    mi.cbSize = ctypes.sizeof(_MONITORINFO)
    _user32.GetMonitorInfoW(hmon, ctypes.byref(mi))
    w = mi.rcWork
    return (w.left, w.top, w.right, w.bottom)


def _set_window_rect(hwnd: int, left: int, top: int, width: int, height: int) -> None:
    SWP_NOZORDER = 0x0004
    SWP_NOACTIVATE = 0x0010
    _user32.SetWindowPos(wintypes.HWND(hwnd), wintypes.HWND(0), left, top, width, height, SWP_NOZORDER | SWP_NOACTIVATE)

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

    # Leading underscore is load-bearing, not style: pywebview's
    # inject_pywebview() walks every attribute of this instance via dir() to
    # auto-discover JS-callable methods, and explicitly skips anything
    # starting with "_" — but does NOT skip plain data attributes otherwise,
    # so a bare `window = None` here (as this was originally written) is
    # itself walked once real_window is assigned, recursing into the live
    # webview.Window object: window -> window.native (the raw WinForms
    # Form) -> .AccessibilityObject.Bounds -> a self-referential property
    # chain that blows the recursion limit on every single launch. That
    # RecursionError pegs the UI thread building the JS bridge, which is
    # the "app not responding" freeze — not Xbox Game Bar, not any
    # accessibility tool, not anything external; this fires unconditionally
    # on startup because inject_pywebview() runs for every page load.
    _window = None  # set once the real window exists, in main()
    _drag_origin = None  # (mouse_x, mouse_y, win_x, win_y) at drag start, screen coords
    _restore_bounds = None  # (x, y, width, height) saved by maximize(), consumed by restore()

    # Drag uses the same raw-Win32 path as maximize (GetWindowRect +
    # SetWindowPos, physical pixels) rather than pywebview's window.move():
    # move() on a frameless WinForms window passes None into SetWindowPos and
    # raises TypeError on every mousemove, so titlebar dragging — the only way
    # to move a frameless window — was completely broken.
    def start_drag(self, screen_x: float, screen_y: float) -> None:
        left, top, _r, _b = _get_window_rect(self._hwnd())
        TitlebarApi._drag_origin = (screen_x, screen_y, left, top)

    def drag(self, screen_x: float, screen_y: float) -> None:
        if TitlebarApi._drag_origin is None:
            return
        origin_x, origin_y, win_left, win_top = TitlebarApi._drag_origin
        hwnd = self._hwnd()
        scale = _window_dpi_scale(hwnd)
        left, top, right, bottom = _get_window_rect(hwnd)
        new_left = int(win_left + (screen_x - origin_x) * scale)
        new_top = int(win_top + (screen_y - origin_y) * scale)
        _set_window_rect(hwnd, new_left, new_top, right - left, bottom - top)

    def end_drag(self) -> None:
        TitlebarApi._drag_origin = None

    def minimize(self) -> None:
        TitlebarApi._window.minimize()

    @staticmethod
    def _hwnd() -> int:
        # webview.Window.native is the WinForms Form; .Handle is its HWND.
        return int(TitlebarApi._window.native.Handle.ToInt64())

    # Not window.maximize(): pywebview's native WindowState.Maximized is a
    # WinForms quirk for FormBorderStyle=None (frameless) windows — with no
    # non-client area for Windows to compute maximize bounds from, it
    # silently no-ops instead of filling the screen. Fill it ourselves with
    # the monitor's work area (screen minus taskbar), via raw Win32 in
    # physical pixels (see the _get_window_rect/_set_window_rect helpers up
    # top for why not pywebview's DPI-scaled resize/move). Also used at
    # startup (main(), on the `shown` event) since maximized=True at
    # create_window() time hits the same no-op.
    def maximize(self) -> None:
        hwnd = self._hwnd()
        TitlebarApi._restore_bounds = _get_window_rect(hwnd)
        left, top, right, bottom = _monitor_work_area(hwnd)
        _set_window_rect(hwnd, left, top, right - left, bottom - top)

    def restore(self) -> None:
        if TitlebarApi._restore_bounds is None:
            return
        left, top, right, bottom = TitlebarApi._restore_bounds
        TitlebarApi._restore_bounds = None
        _set_window_rect(self._hwnd(), left, top, right - left, bottom - top)

    def close(self) -> None:
        TitlebarApi._window.destroy()


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
    # tell (restyle spec §9).
    #
    # easy_drag is OFF: in the installed pywebview version it makes *any*
    # mousedown+drag anywhere in the window move the OS window, with no
    # exclusion for interactive elements (the drag_selector/
    # drag_region_direct_target_only knobs referenced in webview/js/
    # customize.js aren't exposed by this version's create_window()) — that
    # was hijacking drags on ManualOverridePanel's <input type="range">
    # sliders. Titlebar.tsx does its own drag tracking instead, scoped to
    # just its label area, via TitlebarApi.start_drag/drag/end_drag below.
    window = webview.create_window(
        "Compressor Simulator — Ariel JGH/4",
        f"http://127.0.0.1:{port}",
        width=1600,
        height=980,
        min_size=(1280, 760),
        background_color="#C6C6C6",
        frameless=True,
        easy_drag=False,
        js_api=TitlebarApi(),
    )
    TitlebarApi._window = window
    window.events.closing += lambda: (backend.stop(), True)
    # Starts maximized: the P&ID mimic is an SVG that scales to fill its
    # container (PidDiagram.tsx's viewBox math), so a bigger window is the
    # lever for bigger symbols/text without touching that layout. Done via
    # the `shown` event + TitlebarApi.maximize() rather than the
    # create_window(maximized=True) kwarg — that kwarg drives the same
    # broken WindowState.Maximized path documented on maximize() above.
    window.events.shown += lambda: TitlebarApi().maximize()

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
