# Dependencies and Environment Rules

## 1. Critical rule for the coding agent

**Do not assume a library is installed. Do not assume a library is missing. Inspect first.**

Before implementation, detect the project's actual dependency management.

Backend possibilities include:

- `requirements.txt`
- `requirements-dev.txt`
- `pyproject.toml`
- `poetry.lock`
- `uv.lock`
- `Pipfile`

Frontend possibilities include:

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`

Use the package manager already used by the repository.

---

## 2. Backend packages

The practical physics upgrade should be implementable primarily with Python's standard library plus the numerical/framework packages already expected in the project.

### Likely required / acceptable

- `numpy` — numerical calculations and arrays if already used or genuinely useful.
- `fastapi` — existing backend framework.
- `pydantic` — existing API/config models if already used through FastAPI/project conventions.
- `pyyaml` — only if the repository already uses YAML through it or equivalent.
- `pytest` — automated backend tests.
- `pywebview` — desktop shell if used by the current application.

### Optional

- `scipy` — only add if a specific implementation genuinely needs it. The proposed Level-2 physics does **not** require SciPy.

### Do not add for this phase unless already present and explicitly justified

- CoolProp;
- REFPROP bindings;
- Cantera;
- heavy optimization libraries;
- proprietary OEM libraries.

The first upgrade should remain maintainable without them.

---

## 3. Frontend packages

Inspect the current stack first.

### Existing/preferred concepts

- React
- TypeScript if already used
- Tailwind CSS
- shadcn/ui copied components where already established
- Radix primitives where required by the installed shadcn components
- Lucide icons

### Trends

If the project does not already have a suitable high-performance real-time trend library, install:

- `uplot`

If ECharts is already present and working well, it is acceptable to keep it instead of adding uPlot.

### Process diagram

Prefer native React + SVG/CSS for the compressor process mimic.

Do **not** add React Flow merely to draw a fixed P&ID-like process path unless the application already depends on it or a real editing requirement exists.

### State management

Do not add Redux/Zustand solely for this upgrade if existing React state/context/query patterns are adequate.

---

## 4. Required preflight commands

The coding agent must adapt these to the actual environment.

### Python

Determine interpreter and environment:

```bash
python --version
python -m pip --version
```

Inspect installed packages:

```bash
python -m pip list
```

Run import checks for packages the project actually needs:

```bash
python - <<'PY'
mods = ["fastapi", "pydantic", "numpy", "yaml", "pytest", "webview"]
for name in mods:
    try:
        __import__(name)
        print(f"OK   {name}")
    except Exception as exc:
        print(f"MISS {name}: {exc}")
PY
```

The module import name may differ from the package name (`webview` vs `pywebview`, `yaml` vs `PyYAML`).

### Frontend

Inspect:

```bash
node --version
npm --version
cat frontend/package.json
```

If the repo uses pnpm/yarn, use that instead of npm.

Then verify the dependency tree, for example:

```bash
npm --prefix frontend ls --depth=0
```

Do not install a second package manager.

---

## 5. Installation rule

If a necessary package is missing:

1. explain in the coding transcript why it is necessary;
2. install it with the repository's current package manager;
3. persist it in the appropriate dependency file;
4. do not globally install it unless the project explicitly uses global tooling;
5. run the relevant import/build/test after installation.

Examples only:

```bash
python -m pip install <package>
```

or

```bash
npm --prefix frontend install <package>
```

But prefer editing/installing through the project's existing dependency workflow.

---

## 6. Dependency minimization

For this upgrade, adding a package is justified only when it gives a clear benefit that would otherwise require substantial custom code.

Good example:

- adding `uplot` when there is no usable trend library.

Bad examples:

- adding a full diagram framework for a fixed process drawing;
- adding a thermodynamics suite when the phase explicitly uses ideal gas;
- adding a state library to replace working React state for no clear reason.

---

## 7. Build verification

Before declaring completion, run the project's equivalent of:

### Backend

```bash
pytest
```

and any existing lint/type checks.

### Frontend

```bash
npm --prefix frontend run build
```

plus existing test/lint/typecheck scripts from `package.json`.

### Desktop shell

Launch the application through the actual pywebview/desktop entry point and verify that:

- backend starts;
- frontend loads;
- live data connects;
- no missing JS/CSS assets;
- no import/module errors;
- no blank screen;
- process page updates;
- trend page receives data.
