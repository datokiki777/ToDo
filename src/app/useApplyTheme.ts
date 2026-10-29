import { useEffect } from 'react';
import { useSettings } from '@/core/settings/store';

const BAR_COLORS = { light: '#f2f4f5', dark: '#101416' } as const;

/** Resolves "system" to light/dark, sets it on <html>, and follows OS changes live. */
export function useApplyTheme() {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (query.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', BAR_COLORS[resolved]);
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);
}
