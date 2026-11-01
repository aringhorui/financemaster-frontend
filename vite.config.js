import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The /api proxy forwards to the Spring Boot backend, so the browser only ever talks to this
// server: one port to expose, and no CORS. The same proxy serves `npm run dev` and `npm run serve`.
const api = {
  '/api': {
    target: 'http://localhost:8080',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}

// Host names allowed to reach the server besides localhost: Cloudflare quick tunnels, plus any
// extra names (e.g. your own domain on a named tunnel) as a comma-separated PUBLIC_HOSTS env var.
const allowedHosts = ['.trycloudflare.com', ...(process.env.PUBLIC_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean)]

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy: api, allowedHosts },
  preview: { port: 3000, strictPort: true, proxy: api, allowedHosts },
})
