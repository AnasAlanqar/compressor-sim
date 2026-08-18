import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'legacy';

const STORAGE_KEY = 'hmi-theme';

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'legacy' ? stored : 'light';
}

/** Applies data-theme to <html> and wires Ctrl+Shift+L to flip light <-> legacy
 * — the A/B toggle called for in the HMI restyle so old and new can be judged
 * side by side without a rebuild. Remove only when the legacy theme itself is
 * removed (post-review). */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'L') {
        e.preventDefault();
        setThemeState((prev) => (prev === 'legacy' ? 'light' : 'legacy'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return [theme, setThemeState];
}
