import { createFileRoute, redirect } from "@tanstack/react-router";

import { validateBrowseSearch } from "../lib/browse-listings";
import { getAppEcosystemCategoryIdFromRouteParam } from "../lib/directory-categories";

/** Legacy "all tools in ecosystem" list — now `/apps?in=apps/<app>`. */
export const Route = createFileRoute("/_header-layout/ecosystems/$app/all")({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/apps",
      search: {
        in: getAppEcosystemCategoryIdFromRouteParam(params.app) ?? undefined,
        sort: validateBrowseSearch(search).sort,
      },
      statusCode: 301,
    });
  },
});
