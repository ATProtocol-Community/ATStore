import { createFileRoute, redirect } from "@tanstack/react-router";

import { validateBrowseSearch } from "../lib/browse-listings";

/** Legacy "all apps" list — now the unfiltered `/apps` browse page. */
export const Route = createFileRoute("/_header-layout/apps/all")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/apps",
      search: { sort: validateBrowseSearch(search).sort },
      statusCode: 301,
    });
  },
});
