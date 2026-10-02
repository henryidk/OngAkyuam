import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Configuración aparte de `vite.config.ts`: las pruebas no participan del build de producción.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
