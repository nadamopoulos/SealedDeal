import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // @vercel/blob/client imports from 'undici' which is Node.js-only.
      // The package has a browser shim but Vite doesn't apply the parent
      // package's "browser" field. Alias undici to the shim explicitly.
      'undici': path.resolve(__dirname, './node_modules/@vercel/blob/dist/undici-browser.js'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
