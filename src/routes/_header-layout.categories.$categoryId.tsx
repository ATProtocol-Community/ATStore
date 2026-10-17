import { createFileRoute, redirect } from "@tanstack/react-router";

import { validateBrowseSearch } from "../lib/browse-listings";
import { getDirectoryCategoryOption } from "../lib/directory-categories";

/** Legacy category page — now the `/apps?in=<category>` filter (category plus descendants). */
export const Route = createFileRoute("/_header-layout/categories/$categoryId")({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/apps",
      search: {
        in: getDirectoryCategoryOption(params.categoryId)?.id,
        sort: validateBrowseSearch(search).sort,
      },
      statusCode: 301,
    });
  },
});
