import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // @vercel/blob/client imports 'undici' and 'crypto' which are Node.js-only.
      // The package has browser shims but Vite doesn't apply the parent
      // package's "browser" field. Alias both to the shims explicitly.
      'undici': path.resolve(__dirname, './node_modules/@vercel/blob/dist/undici-browser.js'),
      'crypto': path.resolve(__dirname, './node_modules/@vercel/blob/dist/crypto-browser.js'),
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
