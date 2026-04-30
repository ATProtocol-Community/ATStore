import type { KnipConfig } from "knip";

export default {
  vite: true,
  vitest: true,
  ignore: [
    "src/routeTree.gen.ts",
    "src/lexicons/generated/**",
  ],
  ignoreDependencies: [
    // Pulled in via @tanstack/react-start / TanStack Router Vite integration, not a direct import.
    "@tanstack/router-plugin",
    // Invoked as `pnpm exec lex` inside lex:gen bash script (not a static import).
    "@atproto/lex-cli",
    // Dev-time MCP server dependency (see .cursor/mcp.json), not imported from app code.
    "hip-ui",
  ],
} satisfies KnipConfig;
