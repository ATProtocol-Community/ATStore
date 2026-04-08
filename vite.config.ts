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
