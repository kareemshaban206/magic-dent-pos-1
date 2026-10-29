import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  root: dir,
  server: {
    host: true,
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true }
    }
  },
  preview: {
    host: true,
    allowedHosts: ['.monkeycode-ai.live']
  },
  build: {
    outDir: path.resolve(dir, '../dist'),
    emptyOutDir: true
  }
})
