import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
//
// The @nice-devone CXone SDK relies on Node built-ins (Buffer, etc.) that the
// browser does not provide. nodePolyfills shims them so the SDK works at
// runtime. Without this, login can fail with "Buffer is not defined".
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Provide globals the SDK expects in the browser.
      globals: { Buffer: true, global: true, process: true },
      // Polyfill Node protocol imports (e.g. "node:buffer") as well.
      protocolImports: true,
    }),
  ],
})
