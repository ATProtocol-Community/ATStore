import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
} from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { AppTagHero } from "../components/AppTagHero";
import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { SearchField } from "../design-system/search-field";
import { StarRating } from "../design-system/star-rating";
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
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getProtocolPageHeroArtSpec } from "../lib/protocol-page-hero-art";

const LinkLink = createLink(Link);

export const Route = createFileRoute("/protocol/listings")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getAllProtocolListingsQueryOptions,
    ),
  component: ProtocolListingsPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  navLinks: {
    flexWrap: "wrap",
  },
  resultsHeader: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  resultCount: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
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
    contentVisibility: "auto",
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
  listingTagline: {
    flexGrow: 1,
  },
  listingFooter: {
    alignItems: "center",
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  searchFieldRow: {
    flexGrow: 1,
    maxWidth: "40rem",
    width: "100%",
  },
});

function ProtocolListingsPage() {
  const { data: listings } = useSuspenseQuery(
    directoryListingApi.getAllProtocolListingsQueryOptions,
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return listings;
    }

    return listings.filter((listing) =>
      [
        listing.name,
        listing.tagline,
        listing.category,
        listing.description,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [listings, normalizedQuery]);

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large" style={styles.page}>
          <Flex direction="column" gap="7xl">
            <Flex direction="column" gap="4xl">
              <Flex gap="xl" justify="between" style={styles.navLinks}>
                <LinkLink to="/">
                  <ChevronLeft />
                  Home
                </LinkLink>
                <LinkLink to="/protocol/tags">Browse by category</LinkLink>
              </Flex>

              <AppTagHero
                description="Search every protocol listing in the directory — infrastructure, tooling, and services filed under protocol/*."
                eyebrow={`${listings.length} protocol listings`}
                imageSrc={getProtocolPageHeroArtSpec("listings")?.assetPath}
                title="Search protocol listings"
              />
            </Flex>

            <Flex direction="column" gap="4xl">
              <Flex align="center" gap="2xl" style={styles.resultsHeader}>
                <Flex
                  align="center"
                  direction="row"
                  gap="2xl"
                  style={styles.searchFieldRow}
                >
                  <SearchField
                    aria-label="Search all protocol listings"
                    onChange={setQuery}
                    placeholder="Search protocol listings"
                    value={query}
                    variant="secondary"
                    size="lg"
                  />
                  <SmallBody style={styles.resultCount}>
                    {getResultsLabel(
                      filtered.length,
                      listings.length,
                      normalizedQuery,
                    )}
                  </SmallBody>
                </Flex>
              </Flex>

              {filtered.length > 0 ? (
                <Grid style={styles.listingGrid}>
                  {filtered.map((listing) => (
                    <ProtocolListingCard key={listing.id} listing={listing} />
                  ))}
                </Grid>
              ) : (
                <Flex direction="column" style={styles.emptyState}>
                  <Text size="2xl" weight="semibold">
                    No listings matched your search
                  </Text>
                  <Body variant="secondary">
                    Try a different keyword, or browse categories to explore by
                    area instead.
                  </Body>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function ProtocolListingCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      params={{ productId: getDirectoryListingSlug(listing) }}
      to="/products/$productId"
      {...stylex.props(styles.listingLink)}
    >
      <Card style={styles.listingCard}>
        <Flex direction="column" style={styles.listingCardBody}>
          <Flex align="center" gap="2xl" style={styles.listingHeader}>
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
              <Flex align="center" gap="lg">
                <SmallBody variant="secondary">{listing.category}</SmallBody>
                <SmallBody variant="secondary">
                  {listing.rating.toFixed(1)}
                </SmallBody>
                <StarRating rating={listing.rating} />
              </Flex>
            </Flex>
          </Flex>

          <Body variant="secondary" style={styles.listingTagline}>
            {listing.tagline}
          </Body>

          <div />

          <Flex gap="xl" justify="between" style={styles.listingFooter}>
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

function getResultsLabel(
  filteredCount: number,
  totalCount: number,
  normalizedQuery: string,
) {
  if (!normalizedQuery) {
    return `${totalCount} listings`;
  }

  return `Showing ${filteredCount} of ${totalCount} listings`;
}
