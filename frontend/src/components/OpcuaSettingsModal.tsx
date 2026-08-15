import { useEffect, useState } from 'react';

interface OpcuaConfig {
  endpoint: string;
  namespace_uri: string;
  browse_path_prefix: string[];
  watchdog_timeout_s: number;
  node_addressing: 'browse' | 'node_id';
  node_id_pattern: string | null;
  tag_types: Record<string, string>;
  /** Derived server-side: true iff tag_types currently Float-overrides every
   * analog write tag — CODESYS's REAL is 32-bit, this app's implicit
   * default is Double, and writing Double to a REAL raises BadTypeMismatch. */
  codesys_real_tags: boolean;
}

interface ConfigResponse {
  current: OpcuaConfig;
  profiles: Record<string, OpcuaConfig>;
  active_profile: string | null;
}

interface DiscoverNamespace {
  index: number;
  uri: string;
}

interface DiscoverChild {
  browse_name: string;
  display_name: string;
  is_variable: boolean;
}

interface DiscoverResponse {
  ok: boolean;
  error?: string;
  namespaces?: DiscoverNamespace[];
  path?: string[];
  children?: DiscoverChild[];
}

const EMPTY: OpcuaConfig = {
  endpoint: '',
  namespace_uri: '',
  browse_path_prefix: [],
  watchdog_timeout_s: 2,
  node_addressing: 'browse',
  node_id_pattern: '',
  tag_types: {},
  codesys_real_tags: false,
};

// Editable form fields — browse_path_prefix rendered as a comma-separated
// string here, split back into an array on save.
interface FormState {
  endpoint: string;
  namespace_uri: string;
  browse_path_prefix: string;
  watchdog_timeout_s: string;
  node_addressing: 'browse' | 'node_id';
  node_id_pattern: string;
  codesys_real_tags: boolean;
}

function toForm(cfg: OpcuaConfig): FormState {
  return {
    endpoint: cfg.endpoint ?? '',
    namespace_uri: cfg.namespace_uri ?? '',
    browse_path_prefix: (cfg.browse_path_prefix ?? []).join(', '),
    watchdog_timeout_s: String(cfg.watchdog_timeout_s ?? 2),
    node_addressing: cfg.node_addressing ?? 'browse',
    node_id_pattern: cfg.node_id_pattern ?? '',
    codesys_real_tags: cfg.codesys_real_tags ?? false,
  };
}

function fromForm(form: FormState) {
  return {
    endpoint: form.endpoint.trim(),
    namespace_uri: form.namespace_uri.trim(),
    browse_path_prefix: form.browse_path_prefix
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    watchdog_timeout_s: Number(form.watchdog_timeout_s) || 2,
    node_addressing: form.node_addressing,
    node_id_pattern: form.node_id_pattern.trim(),
    codesys_real_tags: form.codesys_real_tags,
  };
}

export default function OpcuaSettingsModal({
  disabled,
  onClose,
  onSaved,
}: {
  /** True while OPC UA is connected — fields disabled, must disconnect first. */
  disabled: boolean;
  onClose: () => void;
  onSaved: (endpoint: string) => void;
}) {
  const [form, setForm] = useState<FormState>(toForm(EMPTY));
  const [profiles, setProfiles] = useState<Record<string, OpcuaConfig>>({});
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Discover" — a read-only tree browser (/api/opcua/discover) for a new
  // user who doesn't know their PLC's namespace URI or browse path yet.
  // Uses its own throwaway connection server-side, so it's safe to run
  // regardless of whether the app is already connected to something else.
  const [discOpen, setDiscOpen] = useState(false);
  const [discBusy, setDiscBusy] = useState(false);
  const [discError, setDiscError] = useState<string | null>(null);
  const [discNamespaces, setDiscNamespaces] = useState<DiscoverNamespace[]>([]);
  const [discPath, setDiscPath] = useState<string[]>([]);
  const [discChildren, setDiscChildren] = useState<DiscoverChild[]>([]);

  const load = () => {
    fetch('/api/opcua/config')
      .then((r) => r.json())
      .then((c: ConfigResponse) => {
        setForm(toForm(c.current));
        setProfiles(c.profiles ?? {});
        setActiveProfile(c.active_profile ?? null);
      })
      .catch(() => setError('failed to load OPC UA config'));
  };

  useEffect(load, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const runDiscover = async (path: string[]) => {
    const endpoint = form.endpoint.trim();
    if (!endpoint) {
      setDiscError('enter an endpoint above first');
      return;
    }
    setDiscBusy(true);
    setDiscError(null);
    try {
      const r = await fetch('/api/opcua/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, path }),
      });
      const data: DiscoverResponse = await r.json();
      if (!data.ok) {
        setDiscError(data.error ?? 'discover failed');
        return;
      }
      setDiscNamespaces(data.namespaces ?? []);
      setDiscPath(data.path ?? path);
      setDiscChildren(data.children ?? []);
    } catch {
      setDiscError('discover failed — is the endpoint reachable?');
    } finally {
      setDiscBusy(false);
    }
  };

  const openDiscover = () => {
    setDiscOpen(true);
    runDiscover([]);
  };

  const descendInto = (child: DiscoverChild) => {
    if (child.is_variable || discBusy) return;
    runDiscover([...discPath, child.browse_name]);
  };

  const goToDepth = (depth: number) => runDiscover(discPath.slice(0, depth));

  const useDiscoveredPath = () => {
    setField('browse_path_prefix', discPath.join(', '));
    // Every browse-tree segment is already namespace-tagged ("5:GVL_PLC") —
    // the namespace a folder lives in is the namespace its tags live in, so
    // reuse the last segment's index instead of making the user separately
    // puzzle out which of the (often 5+) advertised namespaces is "theirs".
    const last = discPath[discPath.length - 1];
    const lastIndex = last ? Number(last.split(':')[0]) : NaN;
    const ns = discNamespaces.find((n) => n.index === lastIndex);
    if (ns) setField('namespace_uri', ns.uri);
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/opcua/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fromForm(form)),
      });
      const c = await r.json();
      setActiveProfile(null);
      onSaved(c.endpoint ?? '');
    } catch {
      setError('save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/opcua/profiles/${encodeURIComponent(name)}/activate`, { method: 'POST' });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error ?? 'activate failed');
        return;
      }
      setForm(toForm(data.current));
      setActiveProfile(name);
      onSaved(data.current.endpoint ?? '');
    } catch {
      setError('activate failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAsProfile = async () => {
    const name = newProfileName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/opcua/profiles/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fromForm(form)),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error ?? 'save profile failed');
        return;
      }
      setNewProfileName('');
      setActiveProfile(name);
      load();
    } catch {
      setError('save profile failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      await fetch(`/api/opcua/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' });
      load();
    } catch {
      setError('delete failed');
    } finally {
      setBusy(false);
    }
  };

  const profileNames = Object.keys(profiles).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[520px] max-w-[90vw] rounded border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-100">OPC UA connection</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            ✕
          </button>
        </div>

        {disabled && (
          <div className="mb-3 rounded border border-amber-700/50 bg-amber-950/30 px-2 py-1 text-xs text-amber-400">
            Disconnect before changing connection settings.
          </div>
        )}

        {profileNames.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Saved profiles</div>
            <div className="flex flex-wrap gap-1.5">
              {profileNames.map((name) => (
                <div
                  key={name}
                  className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                    activeProfile === name
                      ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-300'
                  }`}
                >
                  <button
                    onClick={() => handleActivate(name)}
                    disabled={disabled || busy || activeProfile === name}
                    className="disabled:opacity-70"
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => handleDelete(name)}
                    disabled={busy}
                    className="text-neutral-500 hover:text-red-400"
                    title={`delete "${name}"`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[120px_1fr] items-center gap-2">
          <label className="text-neutral-400">Endpoint</label>
          <div className="flex gap-1.5">
            <input
              value={form.endpoint}
              onChange={(e) => setField('endpoint', e.target.value)}
              disabled={disabled}
              placeholder="opc.tcp://host:4840"
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 disabled:opacity-50"
            />
            <button
              onClick={() => (discOpen ? setDiscOpen(false) : openDiscover())}
              disabled={disabled || !form.endpoint.trim()}
              title="Browse this server to find its namespace URI and tag path — for a PLC you haven't connected to before"
              className="whitespace-nowrap rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:opacity-50"
            >
              {discOpen ? 'Hide' : 'Discover'}
            </button>
          </div>

          {discOpen && (
            <div className="col-span-2 rounded border border-neutral-700 bg-neutral-950 p-2 text-xs">
              {discBusy && <div className="text-neutral-500">browsing…</div>}
              {discError && <div className="text-red-400">{discError}</div>}
              {!discBusy && !discError && (
                <>
                  <div className="mb-2 text-neutral-500">
                    Click into folders below until you reach your tags — usually a global variable
                    list like <span className="text-neutral-300">GVL_PLC</span>. Then click{' '}
                    <span className="text-neutral-300">"Use this path"</span>: it fills in both
                    Browse path and Namespace URI for you, so you don't need to figure out which
                    namespace below is the right one.
                  </div>

                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1 text-neutral-500">
                      <button onClick={() => goToDepth(0)} className="hover:text-neutral-200">
                        Objects
                      </button>
                      {discPath.map((seg, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span>/</span>
                          <button onClick={() => goToDepth(i + 1)} className="hover:text-neutral-200">
                            {seg}
                          </button>
                        </span>
                      ))}
                    </div>
                    {discPath.length > 0 && (
                      <button
                        onClick={useDiscoveredPath}
                        className="rounded border border-emerald-700 bg-emerald-950/40 px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-950/70"
                      >
                        Use this path
                      </button>
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded border border-neutral-800">
                    {discChildren.length === 0 && (
                      <div className="px-2 py-1 text-neutral-600">no children here</div>
                    )}
                    {discChildren.map((child) => (
                      <button
                        key={child.browse_name}
                        onClick={() => descendInto(child)}
                        disabled={child.is_variable}
                        className="flex w-full items-center justify-between border-b border-neutral-900 px-2 py-1 text-left last:border-0 hover:bg-neutral-800 disabled:hover:bg-transparent"
                      >
                        <span className={child.is_variable ? 'text-neutral-500' : 'text-neutral-200'}>
                          {child.is_variable ? '' : '▸ '}
                          {child.display_name}
                        </span>
                        {child.is_variable && <span className="text-neutral-600">tag</span>}
                      </button>
                    ))}
                  </div>

                  <details className="mt-2 text-neutral-600">
                    <summary className="cursor-pointer hover:text-neutral-400">
                      Raw namespace list ({discNamespaces.length}) — not clickable on purpose. "Use
                      this path" above is the only supported way to set Namespace URI: several of
                      these look plausible (mention "CODESYS", your PC name) but aren't where your
                      tags live, and picking one by hand here is exactly what breaks the connection.
                    </summary>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {discNamespaces.map((ns) => (
                        <span
                          key={ns.index}
                          title={ns.uri}
                          className="max-w-[220px] truncate rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-neutral-500"
                        >
                          {ns.index}: {ns.uri}
                        </span>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </div>
          )}

          <label className="text-neutral-400">Namespace URI</label>
          <input
            value={form.namespace_uri}
            onChange={(e) => setField('namespace_uri', e.target.value)}
            disabled={disabled}
            placeholder="urn:symbolset:Device:Application:Symbol Set"
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 disabled:opacity-50"
          />

          <label className="text-neutral-400">Addressing</label>
          <select
            value={form.node_addressing}
            onChange={(e) => setField('node_addressing', e.target.value as 'browse' | 'node_id')}
            disabled={disabled}
            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 disabled:opacity-50"
          >
            <option value="browse">Browse tree (walk browse path)</option>
            <option value="node_id">Node ID pattern (CODESYS symbols)</option>
          </select>

          {form.node_addressing === 'browse' ? (
            <>
              <label className="text-neutral-400">Browse path</label>
              <input
                value={form.browse_path_prefix}
                onChange={(e) => setField('browse_path_prefix', e.target.value)}
                disabled={disabled}
                placeholder="{ns}:Symbol Set, {ns}:GVL_PLC"
                className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 disabled:opacity-50"
              />
            </>
          ) : (
            <>
              <label className="text-neutral-400">Node ID pattern</label>
              <input
                value={form.node_id_pattern}
                onChange={(e) => setField('node_id_pattern', e.target.value)}
                disabled={disabled}
                placeholder="ns={ns};s=|var|Device.Application.GVL_PLC.{tag}"
                className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 disabled:opacity-50"
              />
            </>
          )}

          <label className="text-neutral-400">Watchdog (s)</label>
          <input
            type="number"
            step="0.1"
            min="0.5"
            value={form.watchdog_timeout_s}
            onChange={(e) => setField('watchdog_timeout_s', e.target.value)}
            disabled={disabled}
            className="w-24 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 disabled:opacity-50"
          />

          <label className="text-neutral-400">CODESYS types</label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.codesys_real_tags}
              onChange={(e) => setField('codesys_real_tags', e.target.checked)}
              disabled={disabled}
            />
            <span className="text-xs text-neutral-500">
              use CODESYS's native types (32-bit REAL, 16-bit INT) instead of this app's Double/
              Int64 defaults — needed for a real CODESYS PLC (BadTypeMismatch otherwise)
            </span>
          </label>
        </div>

        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}

        <div className="mt-4 flex items-center gap-2 border-t border-neutral-800 pt-3">
          <button
            onClick={handleSave}
            disabled={disabled || busy}
            className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 hover:bg-neutral-700 disabled:opacity-50"
          >
            Save
          </button>
          <input
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            disabled={disabled}
            placeholder="Save as new profile…"
            className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs disabled:opacity-50"
          />
          <button
            onClick={handleSaveAsProfile}
            disabled={disabled || busy || !newProfileName.trim()}
            className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 hover:bg-neutral-700 disabled:opacity-50"
          >
            Save as…
          </button>
        </div>
      </div>
    </div>
  );
}
