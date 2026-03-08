import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/context', replacement: path.resolve(__dirname, 'src/shared/context') },
      { find: '@/contexts', replacement: path.resolve(__dirname, 'src/shared/contexts') },
      { find: '@/utils', replacement: path.resolve(__dirname, 'src/shared/utils') },
      { find: '@/core', replacement: path.resolve(__dirname, 'src/core') },
      { find: '@/lib', replacement: path.resolve(__dirname, 'src/shared/lib') },
      { find: '@/config', replacement: path.resolve(__dirname, 'src/shared/config') },
      { find: '@/constants', replacement: path.resolve(__dirname, 'src/shared/constants') },
      { find: '@/components', replacement: path.resolve(__dirname, 'src/components') },
      { find: '@/hooks', replacement: path.resolve(__dirname, 'src/hooks') },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@shared', replacement: path.resolve(__dirname, 'src/shared') },
      { find: '@modules/fazla-mesai', replacement: path.resolve(__dirname, 'src/modules/fazla-mesai') },
      { find: '@modules/kidem-tazminati', replacement: path.resolve(__dirname, 'src/modules/kidem-tazminati') },
      { find: '@modules/yillik-izin', replacement: path.resolve(__dirname, 'src/modules/yillik-izin') },
      { find: '@modules/hafta-tatili', replacement: path.resolve(__dirname, 'src/modules/hafta-tatili') },
    ]
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
})
