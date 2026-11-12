import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { TagIndex } from "../components/shelf/discovery/TagIndex";
import { MoreLink, PageHero } from "../components/shelf/Section";
import { uiColor } from "../design-system/theme/color.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { buildRouteOgMeta } from "../lib/og-meta";

export const Route = createFileRoute("/_header-layout/apps/tags")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getAppsByTagQueryOptions,
    ),
  head: () =>
    buildRouteOgMeta({
      title: "App Collections | at-store",
      description:
        "Explore app collections by workflow tags like analytics, moderation, and automation.",
    }),
  component: AppsAllPage,
});

const styles = stylex.create({
  empty: {
    margin: 0,
    color: uiColor.text1,
    borderTopColor: uiColor.border2,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    paddingTop: 24,
  },
});

function AppsAllPage() {
  const { data: groups } = useSuspenseQuery(
    directoryListingApi.getAppsByTagQueryOptions,
  );

  return (
    <>
      <PageHero
        eyebrow="Collections"
        title="Find your new favorite app"
        description="Explore cross-cutting app tags like analytics, moderation, and automation. Listings can appear in more than one group when they fit multiple workflows."
        aside={<MoreLink to="/apps">All apps</MoreLink>}
      />

      {groups.length > 0 ? (
        <TagIndex groups={groups} />
      ) : (
        <p {...stylex.props(styles.empty)}>
          No tagged app listings are available yet.
        </p>
      )}
    </>
  );
}
