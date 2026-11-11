import { queryOptions } from "@tanstack/react-query";

export type BlueskyProfileExtras = {
  bannerUrl: string | null;
  description: string | null;
};

/**
 * Banner and bio from the public Bluesky AppView. The profile loader only
 * returns name/handle/avatar, so these are fetched in the browser after the
 * page renders; the page shows a plain paper band and no bio until (or
 * unless) they arrive.
 */
export function blueskyProfileExtrasQueryOptions(did: string) {
  return queryOptions({
    queryKey: ["blueskyProfileExtras", did] as const,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async (): Promise<BlueskyProfileExtras | null> => {
      const url = new URL(
        "xrpc/app.bsky.actor.getProfile",
        "https://public.api.bsky.app",
      );
      url.searchParams.set("actor", did);
      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      const raw = (await response.json()) as {
        banner?: unknown;
        description?: unknown;
      };
      const banner =
        typeof raw.banner === "string" && raw.banner.trim() !== ""
          ? raw.banner.trim()
          : null;
      const description =
        typeof raw.description === "string" && raw.description.trim() !== ""
          ? raw.description.trim()
          : null;
      return { bannerUrl: banner, description };
    },
  });
}
