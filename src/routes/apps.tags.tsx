import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
} from "@tanstack/react-router";

import { AppTagHero } from "../components/AppTagHero";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryAppTagGroup,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagCount,
  formatAppTagLabel,
  getAppTagDescription,
  getAppTagSlug,
} from "../lib/app-tag-metadata";
import { getAppTagHeroArtSpec } from "../lib/app-tag-hero-art";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { ChevronLeft } from "lucide-react";

const ButtonLink = createLink(Button);
const INITIAL_SECTION_LISTING_COUNT = 6;

export const Route = createFileRoute("/apps/tags")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getAppsByTagQueryOptions,
    ),
  component: AppsAllPage,
});

const styles = stylex.create({
  listingTagline: {
    flexGrow: 1,
  },
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
  sectionTitle: {
    flexGrow: 1,
  },
  sectionEyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  sectionHeader: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  sectionDescription: {
    maxWidth: "44rem",
  },
  listingGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  listingLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
  },
  listingCard: {
    height: "100%",
    minHeight: "15rem",
  },
  listingCardBody: {
    gap: gap["4xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  listingHeader: {
    gap: gap["2xl"],
  },
  listingInfo: {
    flex: 1,
    minWidth: 0,
  },
  listingFooter: {
    alignItems: "center",
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  gap: {
    gap: 64,
  },
});

function AppsAllPage() {
  const { data: groups } = useSuspenseQuery(
    directoryListingApi.getAppsByTagQueryOptions,
  );

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large" style={styles.page}>
          <Flex direction="column" style={styles.gap}>
            <Flex direction="column" gap="4xl">
              <Flex gap="xl" justify="between" style={styles.navLinks}>
                <Link href="/">
                  <ChevronLeft />
                  Home
                </Link>

                <Link href="/apps/all">All apps</Link>
              </Flex>

              <AppTagHero
                eyebrow="Editorial collections"
                title="Find your new favorite app"
                description="Explore cross-cutting app tags like analytics, moderation, and automation. Listings can appear in more than one group when they fit multiple workflows."
                imageSrc={getAppTagHeroArtSpec("all")?.assetPath}
              />
            </Flex>

            {groups.length > 0 ? (
              <Flex direction="column" style={styles.gap}>
                {groups.map((group) => (
                  <AppTagSection key={group.tag} group={group} />
                ))}
              </Flex>
            ) : (
              <Flex direction="column" style={styles.emptyState}>
                <Body variant="secondary">
                  No tagged app listings are available yet.
                </Body>
              </Flex>
            )}
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function AppTagSection({ group }: { group: DirectoryAppTagGroup }) {
  const visibleListings = group.listings.slice(
    0,
    INITIAL_SECTION_LISTING_COUNT,
  );

  return (
    <Flex direction="column" gap="2xl">
      <Flex direction="column" gap="4xl" style={styles.sectionHeader}>
        <Flex justify="between" align="center" gap="2xl">
          <Flex direction="column" gap="2xl" style={styles.sectionTitle}>
            <Text size="sm" style={styles.sectionEyebrow}>
              {formatAppTagCount(group.count)}
            </Text>
            <Text size="3xl" weight="semibold">
              {formatAppTagLabel(group.tag)}
            </Text>
          </Flex>
          <ButtonLink
            to="/apps/$tag"
            params={{ tag: getAppTagSlug(group.tag) }}
            size="lg"
            variant="secondary"
          >
            View all
          </ButtonLink>
        </Flex>
        <Body variant="secondary" style={styles.sectionDescription}>
          {getAppTagDescription(group.tag)}
        </Body>
      </Flex>

      <Grid style={styles.listingGrid}>
        {visibleListings.map((listing) => (
          <AppTagListingCard
            key={`${group.tag}-${listing.id}`}
            listing={listing}
          />
        ))}
      </Grid>
    </Flex>
  );
}

function AppTagListingCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.listingLink)}
    >
      <Card style={styles.listingCard}>
        <Flex direction="column" style={styles.listingCardBody}>
          <Flex gap="2xl" align="center" style={styles.listingHeader}>
            <Avatar
              alt={listing.name}
              fallback={getInitials(listing.name)}
              size="xl"
              src={listing.iconUrl || undefined}
            />
            <Flex direction="column" gap="xl" style={styles.listingInfo}>
              <Text size="xl" weight="semibold">
                {listing.name}
              </Text>
              <SmallBody variant="secondary">{listing.category}</SmallBody>
            </Flex>
          </Flex>
          <Body variant="secondary" style={styles.listingTagline}>
            {listing.tagline}
          </Body>
          <div />
          <Flex justify="between" gap="xl" style={styles.listingFooter}>
            <Text size="sm" weight="semibold">
              {listing.rating.toFixed(1)} rating
            </Text>
            <Text weight="semibold">{listing.priceLabel}</Text>
          </Flex>
        </Flex>
      </Card>
    </RouterLink>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
