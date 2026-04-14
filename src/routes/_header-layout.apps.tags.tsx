import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink } from "@tanstack/react-router";

import { AppTagCard } from "../components/AppTagCard";
import { AppTagHero } from "../components/AppTagHero";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body } from "../design-system/typography";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { getAppTagHeroArtSpec } from "../lib/app-tag-hero-art";
import { buildRouteOgMeta } from "../lib/og-meta";
import { ChevronLeft } from "lucide-react";

const LinkLink = createLink(Link);

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
      image: getAppTagHeroArtSpec("all")?.assetPath,
    }),
  component: AppsAllPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  navLinks: {
    flexWrap: "wrap",
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  categoriesGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  gap: {
    gap: {
      default: 40,
      [breakpoints.sm]: 64,
    },
  },
});

function AppsAllPage() {
  const { data: groups } = useSuspenseQuery(
    directoryListingApi.getAppsByTagQueryOptions,
  );

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.gap}>
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" justify="between" style={styles.navLinks}>
            <LinkLink to="/home">
              <ChevronLeft />
              Home
            </LinkLink>

            <LinkLink to="/apps/all" search={{ sort: "popular" }}>
              All apps
            </LinkLink>
          </Flex>

          <AppTagHero
            eyebrow="Collections"
            title="Find your new favorite app"
            description="Explore cross-cutting app tags like analytics, moderation, and automation. Listings can appear in more than one group when they fit multiple workflows."
            imageSrc={getAppTagHeroArtSpec("all")?.assetPath}
          />
        </Flex>

        {groups.length > 0 ? (
          <Grid style={styles.categoriesGrid}>
            {groups.map((group) => (
              <AppTagCard key={group.tag} tag={group} />
            ))}
          </Grid>
        ) : (
          <Flex direction="column" style={styles.emptyState}>
            <Body variant="secondary">
              No tagged app listings are available yet.
            </Body>
          </Flex>
        )}
      </Flex>
    </Page.Root>
  );
}
