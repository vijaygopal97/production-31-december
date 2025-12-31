import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Ensure base is set to root
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['convo.convergentview.com', 'opine.exypnossolutions.com', '74.225.250.243', '13.202.181.167', '65.2.183.213', 'localhost', '127.0.0.1'],
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    hmr: {
      // For HTTPS development server via Nginx proxy
      overlay: false,
      // Client connects through Nginx on HTTPS (port 443)
      // Vite dev server runs on port 3000, Nginx proxies WebSocket to it
      protocol: 'wss',
      host: 'opine.exypnossolutions.com',
      clientPort: 443
      // Don't set 'port' here - Vite server runs on port 3000 (from server.port)
    }
  },
  // Suppress source file fetch errors in console
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress warnings about source file fetches
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.message?.includes('.jsx')) {
          return;
        }
        warn(warning);
      }
    },
    // Copy public assets to dist
    copyPublicDir: true,
    // Ensure JSON files are properly inlined in the bundle (set high limit to inline JSON)
    assetsInlineLimit: 1000000, // 1MB - ensures JSON files are inlined, not fetched
    // Ensure all JSON imports are inlined
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  // Optimize dependencies to ensure JSON is bundled
  optimizeDeps: {
    include: ['../data/assemblyConstituencies.json']
  },
  // Ensure public files are accessible
  publicDir: 'public'
})
