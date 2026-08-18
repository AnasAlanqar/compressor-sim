import { useEffect, useState } from 'react';

interface OpcuaConfig {
  endpoint: string;
  namespace_uri: string;
  browse_path_prefix: string[];
  watchdog_timeout_s: number;
  node_addressing: 'auto' | 'browse' | 'node_id';
  node_id_pattern: string | null;
}

interface ConfigResponse {
  current: OpcuaConfig;
  profiles: Record<string, OpcuaConfig>;
  active_profile: string | null;
}

interface ScannedServer {
  address: string;
  endpoint: string;
  name: string | null;
}

interface DiscoverChild {
  browse_name: string;
  display_name: string;
  is_variable: boolean;
}

interface DiscoverResponse {
  ok: boolean;
  error?: string;
  path?: string[];
  children?: DiscoverChild[];
}

type Location = 'local' | 'remote';

// The endpoint string is OPC UA plumbing; the UI speaks "this computer" vs
// "another device + address" instead. localhost/127.0.0.1 (and the default
// CODESYS Control Win case) is "local"; anything else is a remote address,
// with the :4840 default port hidden unless it's non-standard.
function parseEndpoint(ep: string): { location: Location; address: string } {
  const m = ep.match(/^opc\.tcp:\/\/([^/]+)/i);
  const hostport = m ? m[1] : '';
  const [host, port] = hostport.split(':');
  if (!host || host === 'localhost' || host === '127.0.0.1') return { location: 'local', address: '' };
  return { location: 'remote', address: port && port !== '4840' ? `${host}:${port}` : host };
}

function buildEndpoint(location: Location, address: string): string {
  if (location === 'local') return 'opc.tcp://localhost:4840';
  let a = address.trim().replace(/^opc\.tcp:\/\//i, '').replace(/\/.*$/, '');
  if (!a) return '';
  if (!a.includes(':')) a = `${a}:4840`;
  return `opc.tcp://${a}`;
}

export default function OpcuaSettingsModal({
  connected,
  onClose,
  onSaved,
}: {
  /** True while OPC UA is connected — settings are locked, must disconnect first. */
  connected: boolean;
  onClose: () => void;
  onSaved: (endpoint: string) => void;
}) {
  // Simple section — where the PLC is.
  const [location, setLocation] = useState<Location>('local');
  const [address, setAddress] = useState('');

  // Advanced section — CODESYS tree shape. Pre-filled with working defaults;
  // most users never open this.
  const [namespaceUri, setNamespaceUri] = useState('');
  const [browsePath, setBrowsePath] = useState('');
  const [addressing, setAddressing] = useState<'auto' | 'browse' | 'node_id'>('auto');
  const [nodeIdPattern, setNodeIdPattern] = useState('');
  const [watchdog, setWatchdog] = useState('2');

  const [profiles, setProfiles] = useState<Record<string, OpcuaConfig>>({});
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Network scan — find PLCs so nobody has to know an IP by heart.
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScannedServer[] | null>(null);

  // Discover tree (advanced) — for a project that renamed its GVL.
  const [discOpen, setDiscOpen] = useState(false);
  const [discBusy, setDiscBusy] = useState(false);
  const [discError, setDiscError] = useState<string | null>(null);
  const [discPath, setDiscPath] = useState<string[]>([]);
  const [discChildren, setDiscChildren] = useState<DiscoverChild[]>([]);

  const load = () => {
    fetch('/api/opcua/config')
      .then((r) => r.json())
      .then((c: ConfigResponse) => {
        const cur = c.current;
        const { location: loc, address: addr } = parseEndpoint(cur.endpoint ?? '');
        setLocation(loc);
        setAddress(addr);
        setNamespaceUri(cur.namespace_uri ?? '');
        setBrowsePath((cur.browse_path_prefix ?? []).join(', '));
        setAddressing(cur.node_addressing ?? 'auto');
        setNodeIdPattern(cur.node_id_pattern ?? '');
        setWatchdog(String(cur.watchdog_timeout_s ?? 2));
        setProfiles(c.profiles ?? {});
        setActiveProfile(c.active_profile ?? null);
      })
      .catch(() => setError('failed to load OPC UA config'));
  };

  useEffect(load, []);

  const effectiveEndpoint = buildEndpoint(location, address);

  const configBody = () => ({
    endpoint: effectiveEndpoint,
    namespace_uri: namespaceUri.trim(),
    browse_path_prefix: browsePath.split(',').map((s) => s.trim()).filter(Boolean),
    watchdog_timeout_s: Number(watchdog) || 2,
    node_addressing: addressing,
    node_id_pattern: nodeIdPattern.trim(),
  });

  const saveConfig = async () => {
    const r = await fetch('/api/opcua/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configBody()),
    });
    const c = await r.json();
    setActiveProfile(null);
    onSaved(c.endpoint ?? '');
    return c;
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveConfig();
    } catch {
      setError('save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    if (location === 'remote' && !address.trim()) {
      setError('enter the PLC address, or use "Scan my network"');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveConfig();
      const r = await fetch('/api/opcua/connect', { method: 'POST' });
      const data = await r.json();
      if (!data.ok && !data.connected) {
        setError(data.error ? `couldn't connect: ${data.error}` : "couldn't connect");
      }
    } catch {
      setError('connect failed — is the PLC reachable?');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetch('/api/opcua/disconnect', { method: 'POST' });
    } finally {
      setBusy(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    setScanResults(null);
    try {
      const r = await fetch('/api/opcua/scan', { method: 'POST' });
      const data = await r.json();
      setScanResults(data.servers ?? []);
    } catch {
      setScanError('scan failed');
    } finally {
      setScanning(false);
    }
  };

  const pickScanned = (s: ScannedServer) => {
    setLocation('remote');
    setAddress(s.address);
    setScanResults(null);
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
      const cur: OpcuaConfig = data.current;
      const { location: loc, address: addr } = parseEndpoint(cur.endpoint ?? '');
      setLocation(loc);
      setAddress(addr);
      setNamespaceUri(cur.namespace_uri ?? '');
      setBrowsePath((cur.browse_path_prefix ?? []).join(', '));
      setAddressing(cur.node_addressing ?? 'auto');
      setNodeIdPattern(cur.node_id_pattern ?? '');
      setWatchdog(String(cur.watchdog_timeout_s ?? 2));
      setActiveProfile(name);
      onSaved(cur.endpoint ?? '');
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
        body: JSON.stringify(configBody()),
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

  const runDiscover = async (path: string[]) => {
    if (!effectiveEndpoint) {
      setDiscError('set the PLC location above first');
      return;
    }
    setDiscBusy(true);
    setDiscError(null);
    try {
      const r = await fetch('/api/opcua/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: effectiveEndpoint, path }),
      });
      const data: DiscoverResponse = await r.json();
      if (!data.ok) {
        setDiscError(data.error ?? 'discover failed');
        return;
      }
      setDiscPath(data.path ?? path);
      setDiscChildren(data.children ?? []);
    } catch {
      setDiscError('discover failed — is the PLC reachable?');
    } finally {
      setDiscBusy(false);
    }
  };

  const useDiscoveredPath = () => {
    setBrowsePath(discPath.join(', '));
    const last = discPath[discPath.length - 1];
    // Namespace a folder lives in = namespace its tags live in. We don't
    // have the URI here, but Discover already returns namespace-tagged
    // segments; the connect path re-resolves {ns}, so leave namespace_uri
    // alone and just adopt the concrete path.
    if (last) setDiscOpen(false);
  };

  const locked = connected || busy;
  const profileNames = Object.keys(profiles).sort();

  const field =
    'rounded border border-[var(--hmi-rule-strong)] bg-[var(--btn-face)] px-2 py-1 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-[520px] max-w-full overflow-y-auto rounded border border-[var(--hmi-rule-strong)] bg-[var(--hmi-surface)] p-4 text-sm text-[var(--text-value)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-value)]">Connect to a PLC</h2>
          <button onClick={onClose} className="text-[var(--text-tag)] hover:text-[var(--text-label)]">
            ✕
          </button>
        </div>

        {/* Status */}
        <div className="mb-3 flex items-center gap-2 rounded border border-[var(--hmi-rule)] bg-[var(--hmi-chrome)] px-3 py-2">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-[var(--text-value)]' : 'bg-[var(--hmi-surface-sunken)]'}`} />
          <span className="text-[var(--text-label)]">
            {connected ? 'Connected' : 'Not connected'}
          </span>
          {connected && (
            <span className="ml-1 truncate text-xs text-[var(--text-tag)]" title={effectiveEndpoint}>
              {location === 'local' ? 'this computer' : address}
            </span>
          )}
          <div className="ml-auto">
            {connected ? (
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="rounded border border-[var(--hmi-rule-strong)] bg-[var(--btn-face)] px-3 py-1 hover:bg-[var(--btn-face-hover)] disabled:opacity-50"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={busy}
                className="rounded border border-[var(--hmi-rule-strong)] bg-[var(--hmi-surface)] px-4 py-1 font-medium text-[var(--text-value)] hover:bg-[var(--hmi-surface)] disabled:opacity-50"
              >
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {connected && (
          <div className="mb-3 rounded border border-[var(--alm-p2)] bg-[var(--hmi-surface)] px-2 py-1 text-xs text-[var(--alm-p2)]">
            Disconnect to change where the app connects.
          </div>
        )}

        {/* Where is the PLC */}
        <div className="mb-2 text-xs uppercase tracking-wide text-[var(--text-tag)]">Where is the PLC?</div>
        <div className="mb-3 flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="loc"
              checked={location === 'local'}
              onChange={() => setLocation('local')}
              disabled={locked}
            />
            <span>This computer</span>
            <span className="text-xs text-[var(--text-tag)]">— CODESYS runs on this laptop</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="loc"
              checked={location === 'remote'}
              onChange={() => setLocation('remote')}
              disabled={locked}
            />
            <span>Another device on the network</span>
          </label>

          {location === 'remote' && (
            <div className="ml-6 flex flex-col gap-2">
              <div className="flex gap-1.5">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={locked}
                  placeholder="192.168.1.10"
                  className={`flex-1 ${field}`}
                />
                <button
                  onClick={handleScan}
                  disabled={locked || scanning}
                  className="whitespace-nowrap rounded border border-[var(--hmi-rule-strong)] bg-[var(--btn-face)] px-2 py-1 text-xs hover:bg-[var(--btn-face-hover)] disabled:opacity-50"
                >
                  {scanning ? 'Scanning…' : 'Scan my network'}
                </button>
              </div>

              {scanning && (
                <div className="text-xs text-[var(--text-tag)]">
                  Looking for PLCs on your network — this takes a few seconds…
                </div>
              )}
              {scanError && <div className="text-xs text-[var(--alm-p1)]">{scanError}</div>}
              {scanResults && scanResults.length === 0 && (
                <div className="text-xs text-[var(--text-tag)]">
                  No PLCs found. Make sure the PLC is powered on and on the same network, or type its
                  address above.
                </div>
              )}
              {scanResults && scanResults.length > 0 && (
                <div className="overflow-hidden rounded border border-[var(--hmi-rule)]">
                  {scanResults.map((s) => (
                    <button
                      key={s.address}
                      onClick={() => pickScanned(s)}
                      className="flex w-full items-center justify-between border-b border-[var(--hmi-rule)] px-2 py-1.5 text-left last:border-0 hover:bg-[var(--btn-face)]"
                    >
                      <span className="text-[var(--text-value)]">{s.name ?? 'OPC UA server'}</span>
                      <span className="text-xs text-[var(--text-tag)]">{s.address}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && <div className="mb-2 text-xs text-[var(--alm-p1)]">{error}</div>}

        {/* Saved profiles */}
        {profileNames.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-[var(--text-tag)]">Saved PLCs</div>
            <div className="flex flex-wrap gap-1.5">
              {profileNames.map((name) => (
                <div
                  key={name}
                  className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                    activeProfile === name
                      ? 'border-[var(--hmi-rule-strong)] bg-[var(--hmi-surface)] text-[var(--text-value)]'
                      : 'border-[var(--hmi-rule-strong)] bg-[var(--btn-face)] text-[var(--text-label)]'
                  }`}
                >
                  <button
                    onClick={() => handleActivate(name)}
                    disabled={locked || activeProfile === name}
                    className="disabled:opacity-70"
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => handleDelete(name)}
                    disabled={busy}
                    className="text-[var(--text-tag)] hover:text-[var(--alm-p1)]"
                    title={`delete "${name}"`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save row */}
        <div className="mb-2 flex items-center gap-2 border-t border-[var(--hmi-rule)] pt-3">
          <button
            onClick={handleSave}
            disabled={locked}
            className="rounded border border-[var(--hmi-rule-strong)] bg-[var(--btn-face)] px-3 py-1 hover:bg-[var(--btn-face-hover)] disabled:opacity-50"
            title="Save these settings without connecting yet"
          >
            Save
          </button>
          <input
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            disabled={locked}
            placeholder="Save as… (e.g. Site 1 PLC)"
            className={`flex-1 text-xs ${field}`}
          />
          <button
            onClick={handleSaveAsProfile}
            disabled={locked || !newProfileName.trim()}
            className="rounded border border-[var(--hmi-rule-strong)] bg-[var(--btn-face)] px-3 py-1 hover:bg-[var(--btn-face-hover)] disabled:opacity-50"
          >
            Save as…
          </button>
        </div>

        {/* Advanced */}
        <details open={advancedOpen} className="mt-2 border-t border-[var(--hmi-rule)] pt-2">
          <summary
            onClick={(e) => {
              e.preventDefault();
              setAdvancedOpen((v) => !v);
            }}
            className="cursor-pointer text-xs text-[var(--text-tag)] hover:text-[var(--text-label)]"
          >
            {advancedOpen ? '▾' : '▸'} Advanced — how tags are found (default: automatic, nothing to
            set)
          </summary>

          <div className="mt-3 grid grid-cols-[120px_1fr] items-center gap-2">
            <label className="text-[var(--text-tag)]">Find tags by</label>
            <select
              value={addressing}
              onChange={(e) => setAddressing(e.target.value as 'auto' | 'browse' | 'node_id')}
              disabled={locked}
              className={field}
            >
              <option value="auto">Automatic — search the PLC (recommended)</option>
              <option value="browse">Browse path (namespace + tag list)</option>
              <option value="node_id">Node ID pattern</option>
            </select>

            {addressing === 'auto' && (
              <div className="col-span-2 text-xs text-[var(--text-disabled)]">
                The app finds its tags by name anywhere on the PLC — nothing to set here. Only switch
                modes if the PLC exposes its tags somewhere Automatic can't reach.
              </div>
            )}

            {addressing === 'browse' && (
              <>
            <label className="text-[var(--text-tag)]">Tag list name</label>
            <input
              value={browsePath}
              onChange={(e) => setBrowsePath(e.target.value)}
              disabled={locked}
              placeholder="{ns}:Symbol Set, {ns}:GVL_PLC"
              className={field}
            />
            <div />
            <div className="text-xs text-[var(--text-disabled)]">
              The Global Variable List your tags live in. Default GVL_PLC works for most projects.
              Not sure? Use Discover below.
            </div>

            <label className="text-[var(--text-tag)]">Discover</label>
            <div>
              <button
                onClick={() => (discOpen ? setDiscOpen(false) : (setDiscOpen(true), runDiscover([])))}
                disabled={locked || !effectiveEndpoint}
                className="rounded border border-[var(--hmi-rule-strong)] bg-[var(--btn-face)] px-2 py-1 text-xs hover:bg-[var(--btn-face-hover)] disabled:opacity-50"
              >
                {discOpen ? 'Hide' : 'Browse the PLC to find it'}
              </button>
            </div>

            {discOpen && (
              <div className="col-span-2 rounded border border-[var(--hmi-rule-strong)] bg-[var(--hmi-chrome)] p-2 text-xs">
                {discBusy && <div className="text-[var(--text-tag)]">browsing…</div>}
                {discError && <div className="text-[var(--alm-p1)]">{discError}</div>}
                {!discBusy && !discError && (
                  <>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-1 text-[var(--text-tag)]">
                        <button onClick={() => runDiscover([])} className="hover:text-[var(--text-value)]">
                          top
                        </button>
                        {discPath.map((seg, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span>/</span>
                            <button
                              onClick={() => runDiscover(discPath.slice(0, i + 1))}
                              className="hover:text-[var(--text-value)]"
                            >
                              {seg}
                            </button>
                          </span>
                        ))}
                      </div>
                      {discPath.length > 0 && (
                        <button
                          onClick={useDiscoveredPath}
                          className="rounded border border-[var(--hmi-rule-strong)] bg-[var(--hmi-surface)] px-1.5 py-0.5 text-[var(--text-value)] hover:bg-[var(--hmi-surface)]"
                        >
                          Use this
                        </button>
                      )}
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded border border-[var(--hmi-rule)]">
                      {discChildren.length === 0 && (
                        <div className="px-2 py-1 text-[var(--text-disabled)]">nothing here</div>
                      )}
                      {discChildren.map((child) => (
                        <button
                          key={child.browse_name}
                          onClick={() =>
                            !child.is_variable && runDiscover([...discPath, child.browse_name])
                          }
                          disabled={child.is_variable}
                          className="flex w-full items-center justify-between border-b border-[var(--hmi-rule)] px-2 py-1 text-left last:border-0 hover:bg-[var(--btn-face)] disabled:hover:bg-transparent"
                        >
                          <span className={child.is_variable ? 'text-[var(--text-tag)]' : 'text-[var(--text-value)]'}>
                            {child.is_variable ? '' : '▸ '}
                            {child.display_name}
                          </span>
                          {child.is_variable && <span className="text-[var(--text-disabled)]">tag</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

                <label className="text-[var(--text-tag)]">Namespace URI</label>
                <input
                  value={namespaceUri}
                  onChange={(e) => setNamespaceUri(e.target.value)}
                  disabled={locked}
                  placeholder="urn:symbolset:Device:Application:Symbol Set"
                  className={field}
                />
              </>
            )}

            {addressing === 'node_id' && (
              <>
                <label className="text-[var(--text-tag)]">Namespace URI</label>
                <input
                  value={namespaceUri}
                  onChange={(e) => setNamespaceUri(e.target.value)}
                  disabled={locked}
                  placeholder="urn:symbolset:Device:Application:Symbol Set"
                  className={field}
                />
                <label className="text-[var(--text-tag)]">Node ID pattern</label>
                <input
                  value={nodeIdPattern}
                  onChange={(e) => setNodeIdPattern(e.target.value)}
                  disabled={locked}
                  placeholder="ns={ns};s=|var|Device.Application.GVL_PLC.{tag}"
                  className={field}
                />
              </>
            )}

            <label className="text-[var(--text-tag)]">Watchdog (s)</label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              value={watchdog}
              onChange={(e) => setWatchdog(e.target.value)}
              disabled={locked}
              className={`w-24 ${field}`}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
