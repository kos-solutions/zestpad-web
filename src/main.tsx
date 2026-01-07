import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { BrowserRouter } from 'react-router-dom' // <--- IMPORTĂ ASTA


createRoot(document.getElementById('root')!).render(
  <StrictMode>
  
    <BrowserRouter> {/* <--- ÎNCONJOARĂ APP CU ASTA */}
      <App />
    </BrowserRouter>
  </StrictMode>,

)
