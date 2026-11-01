import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend CORS allows http://localhost:3000, and the /api proxy avoids CORS entirely in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
