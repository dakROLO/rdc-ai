import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/foundry-local': {
        target: 'http://127.0.0.1:39839',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/foundry-local/, ''),
      },
    },
  },
})
