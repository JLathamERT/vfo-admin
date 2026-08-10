import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  // Dev-only: keep the dependency scanner on the app entry — public/store/ is a
  // self-contained static page whose bare "three" import resolves via its own importmap.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    historyApiFallback: true
  }
})