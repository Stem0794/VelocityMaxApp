import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './harbor.css'
import './ux-shell.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
