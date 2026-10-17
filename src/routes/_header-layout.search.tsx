import { createFileRoute, redirect } from "@tanstack/react-router";

import { validateBrowseSearch } from "../lib/browse-listings";

/** Legacy search page — search now lives on `/apps?q=`. */
export const Route = createFileRoute("/_header-layout/search")({
  beforeLoad: ({ search }) => {
    const { q, sort } = validateBrowseSearch(search);
    throw redirect({ to: "/apps", search: { q, sort }, statusCode: 301 });
  },
});
