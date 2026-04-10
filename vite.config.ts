import path from 'node:path'

import { browserslistToTargets } from 'lightningcss'
import browserslist from 'browserslist'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import stylexPlugin from '@stylexjs/unplugin'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  // Playwright is Node-only and pulls optional chromium-bidi paths that break esbuild pre-bundling
  // when Vite analyzes server code that dynamically imports it.
  optimizeDeps: {
    exclude: ['playwright', 'playwright-core', 'chromium-bidi'],
  },
  ssr: {
    optimizeDeps: {
      exclude: ['playwright', 'playwright-core', 'chromium-bidi'],
    },
    external: ['playwright', 'playwright-core'],
  },
  plugins: [
    stylexPlugin.vite({
      treeshakeCompensation: true,
      dev: process.env.NODE_ENV !== 'production',
      aliases: {
        '@/*': [path.join(__dirname, './src/*')],
        '#/*': [path.join(__dirname, './src/*')],
      },
      lightningcssOptions: {
        targets: browserslistToTargets(browserslist('baseline 2024')),
      },
    }),
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
