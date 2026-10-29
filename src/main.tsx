import '@fontsource-variable/noto-sans-georgian';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/tokens.css';
import './app/global.css';
import '@/core/i18n';
import App from './app/App';
import { startsOnTab } from './app/tabNav';

// Always start on Notes, even after a reload or an update while a tab was open.
if (startsOnTab(window.location.hash)) {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
