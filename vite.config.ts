import stylexPlugin from "@stylexjs/unplugin/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import { nitro } from "nitro/vite";
import path from "node:path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
  // Playwright is Node-only and pulls optional chromium-bidi paths that break esbuild pre-bundling
  // when Vite analyzes server code that dynamically imports it.
  optimizeDeps: {
    exclude: ["playwright", "playwright-core", "chromium-bidi"],
  },
  ssr: {
    optimizeDeps: {
      exclude: ["playwright", "playwright-core", "chromium-bidi"],
    },
    external: ["playwright", "playwright-core"],
  },
  plugins: [
    stylexPlugin({
      treeshakeCompensation: true,
      dev: process.env.NODE_ENV !== "production",
      aliases: {
        "@/*": [path.join(__dirname, "./src/*")],
        "#/*": [path.join(__dirname, "./src/*")],
      },
      lightningcssOptions: {
        targets: browserslistToTargets(browserslist("baseline 2024")),
      },
    }),
    devtools(),
    nitro(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
