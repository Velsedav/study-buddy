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

// Prevent Chrome/browser from zooming with CTRL + MouseWheel globally
document.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    e.preventDefault();
  }
}, { passive: false });

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
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  </StrictMode>,
)
