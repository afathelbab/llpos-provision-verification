// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/llpos-provision-verification/',
  build: { outDir: 'docs' }  
})
