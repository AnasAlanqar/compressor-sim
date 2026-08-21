import { useState } from 'react';

// pywebview exposes window.pywebview.api.* only inside the real desktop
// shell (desktop.py's TitlebarApi) — undefined in `npm run dev` (plain
// browser), where the buttons harmlessly no-op.
declare global {
  interface Window {
    pywebview?: {
      api?: {
        minimize?: () => void;
        maximize?: () => void;
        restore?: () => void;
        close?: () => void;
        start_drag?: (screenX: number, screenY: number) => void;
        drag?: (screenX: number, screenY: number) => void;
        end_drag?: () => void;
      };
    };
  }
}

function callApi(name: 'minimize' | 'maximize' | 'restore' | 'close') {
  window.pywebview?.api?.[name]?.();
}

// 32px custom titlebar (§9 [A]) — frameless window, no native Windows
// chrome. desktop.py runs with easy_drag=False: this installed pywebview
// version's easy_drag has no element exclusion at all (verified against
// webview/js/customize.js — the drag_selector/drag_region_direct_target_only
// template hooks aren't wired to any create_window() kwarg here), so it was
// starting a native window-move on *any* mousedown+drag anywhere in the
// window, including on top of ManualOverridePanel's <input type="range">
// sliders. Dragging is done by hand below, scoped to just this label area
// (buttons are excluded since they stopPropagation isn't needed — mousedown
// on a <button> still bubbles here, so the drag handler is only bound to
// the label span itself, not the whole titlebar row).
export default function Titlebar() {
  // desktop.py always opens the window with maximized=True, so the initial
  // state has to match that — starting this at `false` meant the first
  // click on the middle button was a no-op maximize() (already maximized)
  // instead of the restore the user expected.
  const [maximized, setMaximized] = useState(true);
  return (
    <div
      className="flex h-8 shrink-0 items-center"
      style={{ backgroundColor: 'var(--hmi-chrome)', borderBottom: 'var(--w-hairline) solid var(--hmi-rule)' }}
    >
      <div
        className="flex flex-1 items-center px-3"
        style={{ height: '100%' }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          window.pywebview?.api?.start_drag?.(e.screenX, e.screenY);
          const onMove = (ev: MouseEvent) => window.pywebview?.api?.drag?.(ev.screenX, ev.screenY);
          const onUp = () => {
            window.pywebview?.api?.end_drag?.();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <span
          className="text-[11px] font-medium uppercase"
          style={{ color: 'var(--text-tag)', letterSpacing: '0.08em' }}
        >
          ARIEL JGH/4 — COMPRESSOR TRAIN
        </span>
      </div>
      <button
        type="button"
        aria-label="Minimize"
        onClick={() => callApi('minimize')}
        className="flex h-8 w-8 items-center justify-center hover:brightness-95"
        style={{ color: 'var(--text-label)' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      <button
        type="button"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => {
          callApi(maximized ? 'restore' : 'maximize');
          setMaximized((m) => !m);
        }}
        className="flex h-8 w-8 items-center justify-center hover:brightness-95"
        style={{ color: 'var(--text-label)' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      <button
        type="button"
        aria-label="Close"
        onClick={() => callApi('close')}
        className="flex h-8 w-8 items-center justify-center"
        style={{ color: 'var(--text-label)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--alm-p1)';
          e.currentTarget.style.color = 'var(--alm-p1-on)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-label)';
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
}
