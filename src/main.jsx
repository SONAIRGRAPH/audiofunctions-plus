import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Reading fonts for the font preference (see data-font in styles/theme.css).
// Only @font-face rules -- a font file is downloaded once it is actually used.
import '@fontsource/atkinson-hyperlegible-next/400.css'
import '@fontsource/atkinson-hyperlegible-next/700.css'
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/700.css'
import '@fontsource/andika/400.css'
import '@fontsource/andika/700.css'
import '@fontsource/opendyslexic/400.css'
import '@fontsource/opendyslexic/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/comic-neue/400.css'
import '@fontsource/comic-neue/700.css'
import './index.css'
import App from './App.jsx'
import { initializeTheme } from './utils/theme' // Import the theme utility

// Initialize theme before rendering
initializeTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
