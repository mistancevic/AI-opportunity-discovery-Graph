import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative base so the built site works both locally and when served from a
  // GitHub Pages project subpath (/AI-opportunity-discovery-Graph/).
  base: './',
  plugins: [react(), tailwindcss()],
})
