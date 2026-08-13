# PyInstaller spec — Windows --onedir build. Run via build.ps1, which runs
# `npm run build` first (frontend/dist must exist before this runs) and
# then `pyinstaller --clean compressor_sim.spec`.
#
# --onedir, not --onefile: onefile unpacks the whole bundle to a temp dir
# on every launch (multi-second cold start, worse AV heuristics hit) —
# onedir starts in under a second and the installer (Part A7) hides the
# folder from the user anyway.
import os

from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

root = os.path.dirname(os.path.abspath(SPEC))
icon_path = os.path.join(root, "assets", "icon.ico")

datas = [
    (os.path.join(root, "frontend", "dist"), "frontend_dist"),
    (os.path.join(root, "backend", "config.yaml"), "config"),
]
# asyncua ships XML nodeset/schema files Analysis's static import scan
# can't see — missing this produces a FileNotFoundError on a .xml that only
# shows up in the frozen build, never in dev.
datas += collect_data_files("asyncua")

a = Analysis(
    ["desktop.py"],
    pathex=[root],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.lifespan.on",
    ],
    excludes=["tkinter", "matplotlib", "pytest", "IPython", "PySide6", "PyQt5"],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="CompressorSim",
    console=False,  # no terminal — all logging goes to %LOCALAPPDATA%\CompressorSim\logs (desktop.py)
    icon=icon_path if os.path.exists(icon_path) else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="CompressorSim",
)
