import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AMYProvider } from './amy/AMYProvider'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AMYProvider>
      <App />
    </AMYProvider>
  </StrictMode>,
)