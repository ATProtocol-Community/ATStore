import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAppTagSlug } from "../lib/app-tag-metadata";
import { validateBrowseSearch } from "../lib/browse-listings";

/** Legacy tag landing page — now `/apps?tag=<slug>`, which renders the same tag hero. */
export const Route = createFileRoute("/_header-layout/apps/$tag")({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/apps",
      search: {
        tag: getAppTagSlug(params.tag.replaceAll("-", " ")),
        sort: validateBrowseSearch(search).sort,
      },
      statusCode: 301,
    });
  },
});
