import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import { SettingsProvider } from './lib/settings.tsx'

import Layout from './components/Layout'
// We will create these pages next
import Home from './pages/Home.tsx'
import Plan from './pages/Plan.tsx'
import Session from './pages/Session.tsx'
import SubjectDetail from './pages/SubjectDetail.tsx'
import Learning from './pages/Learning.tsx'
import Analytics from './pages/Analytics.tsx'
import Settings from './pages/Settings.tsx'
import MetacognitionLogs from './pages/MetacognitionLogs.tsx'
import DevPage from './pages/Dev.tsx'
import BingoDashboard from './pages/bingoals/BingoDashboard.tsx'
import BingoObjectivePage from './pages/bingoals/BingoObjectivePage.tsx'
import './styles/bingoals.css'

// CTRL+Scroll: scale font-size instead of applying zoom (which breaks layout)
let rootFontScale = 1.0;

document.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    rootFontScale = Math.max(0.7, Math.min(1.5, rootFontScale + direction * 0.05));
    document.documentElement.style.fontSize = `${rootFontScale * 100}%`;
  }
}, { passive: false });

// CTRL+0: reset font scale to default
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === '0') {
    e.preventDefault();
    rootFontScale = 1.0;
    document.documentElement.style.removeProperty('font-size');
  }
});

// F11: toggle fullscreen
document.addEventListener('keydown', async (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.setFullscreen(!(await win.isFullscreen()));
  }
});

// Auto-export on close: save to configured paths before the window closes
import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
  const appWindow = getCurrentWindow();
  let closing = false;
  await appWindow.onCloseRequested(async (event) => {
    if (closing) return; // second invocation triggered by appWindow.close() — let it through
    closing = true;
    event.preventDefault();
    try {
      const { autoExportToConfiguredPaths } = await import('./lib/export');
      await autoExportToConfiguredPaths();
    } catch {
      // Never block close due to export failure
    }
    appWindow.close();
  });
});

// Strip any native WebView zoom property if it gets applied
const clearNativeZoom = () => {
  if (document.documentElement.style.zoom) document.documentElement.style.removeProperty('zoom');
  if (document.body?.style.zoom) document.body.style.removeProperty('zoom');
};
new MutationObserver(clearNativeZoom).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
new MutationObserver(clearNativeZoom).observe(document.body, { attributes: true, attributeFilter: ['style'] });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="subject/:id" element={<SubjectDetail />} />
            <Route path="plan" element={<Plan />} />
            <Route path="session" element={<Session />} />
            <Route path="learning" element={<Learning />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="metacognition-logs" element={<MetacognitionLogs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="dev" element={<DevPage />} />
            <Route path="bingoals" element={<BingoDashboard />} />
            <Route path="bingoals/objective/:id" element={<BingoObjectivePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  </StrictMode>,
)
