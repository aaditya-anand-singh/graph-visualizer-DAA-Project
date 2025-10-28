import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ✅ Correct Vite config for GitHub Pages deployment
export default defineConfig({
  plugins: [
    react(),        // Required for React JSX support
    tailwindcss(),  // Required for TailwindCSS
  ],
  base: '/graph-visualizer-DAA-Project/', // 👈 VERY important for GitHub Pages
})
