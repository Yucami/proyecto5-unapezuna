import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['amazon-cognito-identity-js'],
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      include: [/amazon-cognito-identity-js/, /node_modules/],
    },
  },
})