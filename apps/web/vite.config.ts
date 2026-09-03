import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Un solo .env en la raíz del monorepo, mismo patrón que usa apps/api.
  envDir: '../../',
})
