import { defineConfig } from 'vite'

// Use './' so the build works on GitHub Pages (project or user site).
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: true,
  },
})
