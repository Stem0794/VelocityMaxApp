import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/VelocityMaxApp/',
  build: {
    // Disable the modulePreload polyfill — it injects an inline script that
    // violates script-src 'self' CSP. Modern browsers don't need it.
    modulePreload: { polyfill: false },
  },
})
