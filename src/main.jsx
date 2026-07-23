import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import AuthWrapper from './components/ui/AuthWrapper.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AuthWrapper><App /></AuthWrapper>
    </ToastProvider>
  </StrictMode>,
)
