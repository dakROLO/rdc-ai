import { execFileSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

let buildId = 'source build'
try { buildId = execFileSync('git', ['describe', '--always', '--dirty'], { encoding: 'utf8' }).trim() } catch {}

export default defineConfig({
  define: { 'import.meta.env.VITE_CROWNKEEP_BUILD_ID': JSON.stringify(buildId) },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/foundry-local': {
        target: 'http://127.0.0.1:39839',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/foundry-local/, ''),
      },
    },
  },
})
