import type { KnipConfig } from "knip";

export default {
  vite: true,
  vitest: true,
  // Treat the design system as a public surface: every module is a valid entry (consumers import arbitrarily).
  entry: ["src/design-system/**/*.ts", "src/design-system/**/*.tsx"],
  ignore: [
    "src/lexicons/generated/**",
  ],
  // Unused exports/types on shared `src/lib` and large API modules are usually intentional surface, not dead code.
  rules: {
    exports: "off",
    types: "off",
  },
  ignoreDependencies: [
    // Pulled in via @tanstack/react-start / TanStack Router Vite integration, not a direct import.
    "@tanstack/router-plugin",
    // Invoked as `pnpm exec lex` inside lex:gen bash script (not a static import).
    "@atproto/lex-cli",
    // Dev-time MCP server dependency (see .cursor/mcp.json), not imported from app code.
    "hip-ui",
  ],
} satisfies KnipConfig;
