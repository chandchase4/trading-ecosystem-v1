import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages uses a subpath; Codespaces dev preview runs at the root.
  base: command === 'build' ? '/trading-ecosystem-v1/' : '/',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.app.github.dev', '.github.dev'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
}))
