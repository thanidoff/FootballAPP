import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import AuthWrapper from './components/ui/AuthWrapper.jsx'
import AppErrorBoundary from './components/ui/AppErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AppErrorBoundary>
        <AuthWrapper><App /></AuthWrapper>
      </AppErrorBoundary>
    </ToastProvider>
  </StrictMode>,
)
