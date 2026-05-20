import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
// @ts-expect-error CSS import
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
