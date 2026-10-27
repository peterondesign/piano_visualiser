import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TranscribeApp from './TranscribeApp'
import './transcribe.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TranscribeApp />
  </StrictMode>,
)
