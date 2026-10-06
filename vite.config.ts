import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative assets support deployment under a GitHub Pages repository path.
  base: './',
})
