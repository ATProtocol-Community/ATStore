import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
} from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { AppTagHero } from "../components/AppTagHero";
import { FeaturedListingFallbackCard } from "../components/FeaturedListingFallbackCard";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { HeroImage } from "../components/HeroImage";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
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
  type DirectoryProtocolCategoryGroup,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { buildRouteOgMeta } from "../lib/og-meta";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { getProtocolCategoryDescription } from "../lib/protocol-category-metadata";
import { getProtocolPageHeroArtSpec } from "../lib/protocol-page-hero-art";
import { StarRating } from "#/design-system/star-rating";

const ButtonLink = createLink(Button);
const LinkLink = createLink(Link);
const INITIAL_SECTION_LISTING_COUNT = 6;

export const Route = createFileRoute("/_header-layout/protocol/tags")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getProtocolCategoriesQueryOptions,
    ),
  head: () =>
    buildRouteOgMeta({
      title: "Protocol Tools | at-store",
      description:
        "Browse protocol listings by top-level category, from PDS and AppView to supporting infrastructure.",
    }),
  component: ProtocolTagsPage,
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
  listingLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
    position: "relative",
    zIndex: 1,
  },
  listingCard: {
    height: "100%",
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
  pageGap: {
    gap: 64,
  },
});

function ProtocolTagsPage() {
  const { data: groups } = useSuspenseQuery(
    directoryListingApi.getProtocolCategoriesQueryOptions,
  );

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageGap}>
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" justify="between" style={styles.navLinks}>
            <LinkLink to="/home">
              <ChevronLeft />
              Home
            </LinkLink>
            <LinkLink to="/protocol/listings" search={{ sort: "popular" }}>
              All tools
            </LinkLink>
          </Flex>

          <AppTagHero
            description="Browse protocol listings by top-level category — PDS, AppView, and other infrastructure."
            eyebrow="Protocol categories"
            imageSrc={getProtocolPageHeroArtSpec("tags")?.assetPath}
            title="Explore the stack"
          />
        </Flex>

        {groups.length > 0 ? (
          <Flex direction="column" style={styles.pageGap}>
            {groups.map((group, index) => (
              <ProtocolCategorySection
                key={group.categoryId}
                group={group}
                sectionIndex={index}
              />
            ))}
          </Flex>
        ) : (
          <Flex direction="column" style={styles.emptyState}>
            <Body variant="secondary">
              No protocol listings are available yet.
            </Body>
          </Flex>
        )}
      </Flex>
    </Page.Root>
  );
}

function ProtocolCategorySection({
  group,
  sectionIndex,
}: {
  group: DirectoryProtocolCategoryGroup;
  sectionIndex: number;
}) {
  const visibleListings = group.listings.slice(
    0,
    INITIAL_SECTION_LISTING_COUNT,
  );

  const description =
    group.description.trim() ||
    getProtocolCategoryDescription(group.categoryId);

  return (
    <Flex direction="column" gap="2xl">
      <Flex direction="column" gap="4xl" style={styles.sectionHeader}>
        <Flex align="end" gap="2xl" justify="between">
          <Flex direction="column" gap="2xl" style={styles.sectionTitle}>
            <Text size="sm" style={styles.sectionEyebrow}>
              {formatProtocolListingCount(group.count)}
            </Text>
            <Text size="3xl" weight="semibold">
              {group.label}
            </Text>
            <Body variant="secondary" style={styles.sectionDescription}>
              {description}
            </Body>
          </Flex>
          <ButtonLink
            params={{ category: group.segment }}
            size="lg"
            search={{ sort: "popular" }}
            to="/protocol/$category"
            variant="secondary"
          >
            View all
          </ButtonLink>
        </Flex>
      </Flex>

      <FeaturedListingGrid
        hasFeatured={sectionIndex === 0}
        items={visibleListings}
        getKey={(listing) => `${group.categoryId}-${listing.id}`}
        canFeature={(listing) => Boolean(listing.heroImageUrl)}
        renderItem={(listing, { featured }) => (
          <ProtocolListingCard listing={listing} featured={featured} />
        )}
      />
    </Flex>
  );
}

function ProtocolListingCard({
  listing,
  featured = false,
}: {
  listing: DirectoryListingCard;
  featured?: boolean;
}) {
  return (
    <RouterLink
      params={{ productId: getDirectoryListingSlug(listing) }}
      to="/products/$productId"
      {...stylex.props(styles.listingLink)}
    >
      {featured && listing.heroImageUrl ? (
        <HeroImage
          alt={getDirectoryListingHeroImageAlt(listing)}
          glowIntensity={0.8}
          src={listing.heroImageUrl}
        />
      ) : featured ? (
        <FeaturedListingFallbackCard listing={listing} />
      ) : (
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
                <SmallBody variant="secondary">
                  @
                  {listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
                </SmallBody>
              </Flex>
            </Flex>
            <Body variant="secondary" style={styles.listingTagline}>
              {listing.tagline}
            </Body>
            <div />
            <Flex gap="xl" justify="end" style={styles.listingFooter}>
              <Flex align="center" gap="sm">
                <SmallBody variant="secondary">
                  {listing.rating != null ? listing.rating.toFixed(1) : "—"}
                </SmallBody>
                <StarRating
                  rating={listing.rating}
                  reviewCount={listing.reviewCount}
                  showReviewCount
                />
              </Flex>
            </Flex>
          </Flex>
        </Card>
      )}
    </RouterLink>
  );
}

function formatProtocolListingCount(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
