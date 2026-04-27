import { createFileRoute } from "@tanstack/react-router";

import { getAtprotoSessionForRequest } from "#/middleware/auth";

const CANDIDATES_DIR_RELATIVE = "out/hero-candidates";

export const Route = createFileRoute("/api/admin/hero-candidate-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.NODE_ENV === "production") {
          return new Response("Not available in production.", { status: 404 });
        }

        const session = await getAtprotoSessionForRequest(request);
        if (!session?.session.user.isAdmin) {
          return new Response("Forbidden", { status: 403 });
        }

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) {
          return new Response("Missing id", { status: 400 });
        }

        const path = await import("node:path");
        const { readFile } = await import("node:fs/promises");

        const indexPath = path.resolve(
          process.cwd(),
          CANDIDATES_DIR_RELATIVE,
          "index.json",
        );

        let raw: string;
        try {
          raw = await readFile(indexPath, "utf8");
        } catch {
          return new Response("No hero-candidates index found.", {
            status: 404,
          });
        }

        const parsed = JSON.parse(raw) as {
          entries?: Array<{
            id: string;
            candidate: {
              filename: string;
              mimeType: string;
            } | null;
          }>;
        };

        const entry = parsed.entries?.find((row) => row.id === id);
        if (!entry?.candidate) {
          return new Response("No candidate for that listing id.", {
            status: 404,
          });
        }

        const filePath = path.resolve(
          process.cwd(),
          CANDIDATES_DIR_RELATIVE,
          entry.candidate.filename,
        );

        try {
          const buffer = await readFile(filePath);
          return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
              "Content-Type": entry.candidate.mimeType || "image/png",
              "Cache-Control": "no-store",
            },
          });
        } catch {
          return new Response("Candidate file missing on disk.", {
            status: 404,
          });
        }
      },
    },
  },
});
