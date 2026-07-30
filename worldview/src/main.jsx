import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WorldViewProvider } from './WorldViewContext'
import './index.css'
import './worldview.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WorldViewProvider>
      <App />
    </WorldViewProvider>
  </StrictMode>,
)
