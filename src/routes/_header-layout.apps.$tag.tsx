import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAppTagSlug } from "../lib/app-tag-metadata";
import { validateBrowseSearch } from "../lib/browse-listings";
import { GAMES_APP_TAG_SLUG } from "../lib/game-listing";

/** Legacy tag landing page — now `/apps?tag=<slug>`, which renders the same tag hero. */
export const Route = createFileRoute("/_header-layout/apps/$tag")({
  beforeLoad: ({ params, search }) => {
    const tag = getAppTagSlug(params.tag.replaceAll("-", " "));
    if (tag === GAMES_APP_TAG_SLUG) {
      throw redirect({ to: "/games", statusCode: 301 });
    }
    throw redirect({
      to: "/apps",
      search: { tag, sort: validateBrowseSearch(search).sort },
      statusCode: 301,
    });
  },
});
