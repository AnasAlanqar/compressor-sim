"""
Resolves bundled-resource and writable-data paths for both the dev tree and
a PyInstaller-frozen build. See README's "Desktop packaging" section.

Everything that reads a bundled file (frontend dist, the default
config.yaml) or writes user state (the live config.yaml, logs) goes through
here, never a hardcoded relative path — the two run modes have different
roots and PyInstaller's frozen root (`sys._MEIPASS`) is wiped on exit, so
anything written there would silently vanish on restart.
"""
import os
import shutil
import sys
from pathlib import Path


def is_frozen() -> bool:
    return getattr(sys, "frozen", False)


def resource_path(relative: str) -> Path:
    """Read-only file bundled with the app (frontend dist, default config).
    Frozen: under sys._MEIPASS, laid out by compressor_sim.spec's `datas`.
    Dev: relative to the repo root."""
    base = Path(sys._MEIPASS) if is_frozen() else Path(__file__).resolve().parent.parent
    return base / relative


def user_data_dir() -> Path:
    """Writable directory that survives an app reinstall/update: live
    config, logs. Frozen: %LOCALAPPDATA%\\CompressorSim. Dev: a gitignored
    folder in the repo so dev runs don't touch the real install's data."""
    if is_frozen():
        base = Path(os.environ["LOCALAPPDATA"]) / "CompressorSim"
    else:
        base = Path(__file__).resolve().parent.parent / ".local"
    base.mkdir(parents=True, exist_ok=True)
    return base


def config_path() -> Path:
    """The live, editable config.yaml. Dev: the repo's backend/config.yaml
    directly. Frozen: a writable copy under user_data_dir(), seeded once
    from the bundled default so a user's endpoint/profile edits (Part B)
    survive process restarts and app updates."""
    if not is_frozen():
        return resource_path("backend/config.yaml")
    dest = user_data_dir() / "config.yaml"
    if not dest.exists():
        shutil.copy(resource_path("config/config.yaml"), dest)
    return dest


def frontend_dist_path() -> Path:
    """Built frontend assets (`npm run build` output). Frozen: bundled
    under MEIPASS/frontend_dist. Dev: frontend/dist, present only after a
    manual build — the normal dev workflow serves the frontend from Vite
    instead, so callers must handle this directory not existing."""
    if is_frozen():
        return resource_path("frontend_dist")
    return Path(__file__).resolve().parent.parent / "frontend" / "dist"


def log_dir() -> Path:
    p = user_data_dir() / "logs"
    p.mkdir(parents=True, exist_ok=True)
    return p
