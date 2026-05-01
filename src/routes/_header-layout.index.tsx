import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  useNavigate,
} from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

import { AppTagCard } from "../components/AppTagCard";
import { FeaturedListingFallbackCard } from "../components/FeaturedListingFallbackCard";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { HeroImage } from "../components/HeroImage";
import { Alert } from "../design-system/alert";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card, CardImage } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import {
  animationDuration,
  animationTimingFunction,
} from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  Body,
  Heading1,
  Heading2,
  SmallBody,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { buildRouteOgMeta } from "../lib/og-meta";

export const Route = createFileRoute("/_header-layout/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        directoryListingApi.getHomePageQueryOptions,
      ),
      context.queryClient.ensureQueryData(
        directoryListingApi.getProductClaimEligibilityQueryOptions(),
      ),
    ]);
  },
  head: () =>
    buildRouteOgMeta({
      title: "at-store | Apps on the Atmosphere",
      description:
        "Discover apps and tools across the Atmosphere. Find your next favorite app today!",
    }),
  component: HomePage,
});

const AppLink = createLink(Link);

const styles = stylex.create({
  sectionHeaderAction: {
    flexShrink: 0,
  },
  headerDescription: {
    maxWidth: "41rem",
  },
  bentoLink: {
    textDecoration: "none",
    display: "block",
    position: "relative",
    zIndex: 1,
    height: "100%",
  },
  bentoLinkFeatured: {
    zIndex: 0,
  },
  listingCardLink: {
    borderRadius: radius.lg,
    cornerShape: "squircle",
    textDecoration: "none",
    boxShadow: shadow.md,
    display: "block",
    transform: {
      default: "none",
      ":hover": "translateY(-2px)",
    },
    transitionDuration: animationDuration.slow,
    transitionProperty: "transform",
    transitionTimingFunction: "ease-in-out",
    height: "100%",

    ":hover::before": {
      opacity: 1,
    },
    "::before": {
      inset: 0,
      borderRadius: radius.lg,
      cornerShape: "squircle",
      boxShadow: shadow.lg,
      content: "''",
      opacity: 0,
      position: "absolute",
      transitionDuration: animationDuration.slow,
      transitionProperty: "opacity",
      transitionTimingFunction: "ease-in-out",
    },
  },
  claimBanner: {
    width: "100%",
  },
  pageHeader: {
    paddingBottom: {
      default: verticalSpace["8xl"],
      [breakpoints.sm]: verticalSpace["10xl"],
    },
    paddingTop: {
      default: verticalSpace["4xl"],
      [breakpoints.sm]: verticalSpace["8xl"],
    },
  },
  pageSections: {
    gap: {
      default: 40,
      [breakpoints.sm]: 64,
    },
  },
  section: {
    gap: gap["2xl"],
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  promoCard: {
    borderColor: uiColor.component2,
    borderRadius: radius["lg"],
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.none,
    color: uiColor.text2,
    transform: {
      default: "none",
      ":hover": "translateY(-2px)",
    },
    transitionDuration: animationDuration.slow,
    transitionProperty: "transform",
    transitionTimingFunction: "ease-in-out",
    height: "100%",
  },
  promoCardShadow: {
    borderRadius: radius.lg,
    cornerShape: "squircle",
    boxShadow: shadow.md,
    position: "relative",

    ":hover::before": {
      opacity: 1,
    },
    "::before": {
      inset: 0,
      borderRadius: radius.lg,
      cornerShape: "squircle",
      boxShadow: shadow.lg,
      content: "''",
      opacity: 0,
      position: "absolute",
      transitionDuration: animationDuration.default,
      transitionProperty: "opacity",
      transitionTimingFunction: animationTimingFunction.linear,
    },
  },
  promoCardBody: {
    boxSizing: "border-box",
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    justifyContent: "flex-start",
    position: "relative",
    zIndex: 1,
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["sm"],
  },
  promoCardTagline: {
    flexGrow: 1,
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  heroTitle: {
    display: "block",
    maxWidth: "18ch",
  },
  heroDescription: {
    margin: 0,
    maxWidth: "32rem",
  },
  sectionHeader: {
    marginBottom: verticalSpace["3xl"],
  },
  sectionHeaderText: {
    gap: gap["2xl"],
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  categoriesGrid: {
    gap: gap["2xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
  },
  popularGrid: {
    gap: gap["3xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.lg]: "minmax(0, 1.2fr) minmax(18rem, 0.9fr)",
    },
  },
  popularGridSingle: {
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.lg]: "1fr",
    },
  },
  popularList: {
    padding: verticalSpace["2xl"],
    borderColor: uiColor.component2,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    backgroundColor: uiColor.bg,
  },
  listItem: {
    borderRadius: radius.md,
    gap: gap["xl"],
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: {
      default: uiColor.bg,
      ":hover": uiColor.component2,
    },
    boxShadow: shadow.none,
    color: uiColor.text2,
    display: "flex",
    position: "relative",
    transitionDuration: animationDuration.slow,
    transitionProperty: "background-color, z-index",
    transitionTimingFunction: "ease-in-out",
    zIndex: {
      default: 0,
      ":hover": 1,
    },
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],

    ":hover::after": {
      opacity: 1,
    },
    "::after": {
      inset: 0,
      borderRadius: radius.md,
      boxShadow: shadow.lg,
      content: "''",
      opacity: 0,
      position: "absolute",
      transitionDuration: animationDuration.slow,
      transitionProperty: "opacity",
      transitionTimingFunction: "ease-in-out",
    },
  },
  rankNumber: {
    minWidth: "1.25rem",
  },
  listItemText: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  newGrid: {
    gap: gap["lg"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  listingCard: {
    boxSizing: "border-box",
    boxShadow: shadow.none,
    position: "relative",
    height: "100%",
  },
  listingCardContent: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  listItemTagline: {
    flexGrow: 1,
    minWidth: 0,
  },
  exploreButton: {
    borderRadius: radius.full,
    cornerShape: "unset",
    cursor: "pointer",
  },
});

function HomePage() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(
    directoryListingApi.getHomePageQueryOptions,
  );
  const { data: claimEligibility } = useSuspenseQuery(
    directoryListingApi.getProductClaimEligibilityQueryOptions(),
  );
  const promoListing = data.promo;

  const showClaimBanner =
    claimEligibility.eligible && claimEligibility.listings.length > 0;
  const claimCount = claimEligibility.listings.length;

  return (
    <Page.Root variant="large">
      <Flex direction="column" gap="5xl" style={styles.claimBanner}>
        {showClaimBanner ? (
          <Alert
            variant="info"
            title={
              claimCount === 1 ? "Claim your listing" : "Claim your listings"
            }
            action={
              <Button
                variant="primary"
                size="sm"
                onPress={() => void navigate({ to: "/product/claim" })}
              >
                Continue
              </Button>
            }
          >
            {claimCount === 1
              ? `“${(claimEligibility.listings[0]?.name ?? "").trim() || "Listing"}” is still on the store repo. Claim it to manage updates from your PDS.`
              : `You have ${String(claimCount)} listings on the store repo. Claim them to manage updates from your PDS.`}
          </Alert>
        ) : null}

        <Flex direction="column" gap="6xl" style={styles.pageHeader}>
          <Flex direction="column" gap="5xl">
            <Text size="lg" weight="normal" style={styles.eyebrow}>
              The AT Protocol app directory
            </Text>
            <Heading1>Apps on the Atmosphere</Heading1>
          </Flex>
          <Text
            variant="secondary"
            size={{ default: "xl", sm: "2xl" }}
            leading="sm"
            style={styles.headerDescription}
          >
            Discover the best apps the Atmosphere has to offer. With every
            product you own your data and use the same identity across all apps.
          </Text>
        </Flex>
      </Flex>

      <Flex direction="column" style={styles.pageSections}>
        <section {...stylex.props(styles.section)}>
          <FeaturedListingGrid
            items={[data.featured, ...data.spotlights]}
            getKey={(listing, index) =>
              index === 0 ? `featured-${listing.id}` : `spotlight-${listing.id}`
            }
            isFeatured={(_, index) => index === 0}
            canFeature={(listing) => Boolean(listing.heroImageUrl)}
            renderItem={(listing, { featured }) =>
              featured ? (
                <HeroCard listing={listing} />
              ) : (
                <ListingCard listing={listing} />
              )
            }
          />
        </section>

        <section {...stylex.props(styles.section)}>
          <SectionHeader
            eyebrow="Browse Apps"
            title="Find apps you'll love"
            to="/apps/tags"
          />
          <Grid style={styles.categoriesGrid}>
            {data.tags.map((tag, index) => (
              <AppTagCard key={tag.tag} tag={tag} isFeatured={index === 0} />
            ))}
          </Grid>
        </section>

        <section {...stylex.props(styles.section)}>
          <SectionHeader
            eyebrow="Popular Right Now"
            title="Trending across the ecosystem"
            to="/apps/all"
            search={{ sort: "popular" }}
          />
          <Grid
            style={[
              styles.popularGrid,
              promoListing ? null : styles.popularGridSingle,
            ]}
          >
            <Flex direction="column" gap="md" style={styles.popularList}>
              {data.popular.map((listing, index) => (
                <PopularListItem
                  key={listing.id}
                  listing={listing}
                  rank={index + 1}
                />
              ))}
            </Flex>
            {promoListing ? <PromoCard listing={promoListing} /> : null}
          </Grid>
        </section>

        <section {...stylex.props(styles.section)}>
          <SectionHeader
            eyebrow="New & Noteworthy"
            title="Fresh apps just added"
            to="/apps/all"
            search={{ sort: "newest" }}
          />
          <Grid style={styles.newGrid}>
            {data.fresh.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </Grid>
        </section>
      </Flex>
    </Page.Root>
  );
}

type SectionHeaderProps =
  | {
      eyebrow: string;
      title: string;
      to: "/apps/tags";
      search?: never;
    }
  | {
      eyebrow: string;
      title: string;
      to: "/apps/all";
      search: {
        sort: "popular" | "newest";
      };
    };

function SectionHeader({ eyebrow, title, to, search }: SectionHeaderProps) {
  let action: React.ReactNode;

  switch (to) {
    case "/apps/all": {
      action = (
        <AppLink to="/apps/all" search={search}>
          See All <ChevronRight />
        </AppLink>
      );
      break;
    }
    case "/apps/tags": {
      action = (
        <AppLink to="/apps/tags">
          See All <ChevronRight />
        </AppLink>
      );
      break;
    }
  }

  return (
    <Flex align="end" justify="between" gap="2xl" style={styles.sectionHeader}>
      <div {...stylex.props(styles.sectionHeaderText)}>
        <SmallBody style={styles.eyebrow} variant="secondary">
          {eyebrow}
        </SmallBody>
        <Heading2>{title}</Heading2>
      </div>
      {action && (
        <div {...stylex.props(styles.sectionHeaderAction)}>{action}</div>
      )}
    </Flex>
  );
}

function HeroCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(
        styles.bentoLink,
        styles.bentoLinkFeatured,
        stylex.defaultMarker(),
      )}
    >
      {listing.heroImageUrl ? (
        <HeroImage
          alt={getDirectoryListingHeroImageAlt(listing)}
          glowIntensity={0.8}
          src={listing.heroImageUrl}
        />
      ) : (
        <FeaturedListingFallbackCard listing={listing} />
      )}
    </RouterLink>
  );
}

function PopularListItem({
  listing,
  rank,
}: {
  listing: DirectoryListingCard;
  rank: number;
}) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.listItem)}
    >
      <Text
        size="xl"
        weight="semibold"
        variant="secondary"
        style={styles.rankNumber}
      >
        {rank}
      </Text>
      <StoreIcon listing={listing} size="lg" />
      <Flex style={styles.listItemText} direction="column" gap="lg">
        <Text size="lg" weight="semibold">
          {listing.name}
        </Text>
        <SmallBody variant="secondary">{listing.tagline}</SmallBody>
      </Flex>
      <Button variant="secondary" style={styles.exploreButton}>
        Explore
      </Button>
    </RouterLink>
  );
}

function PromoCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.bentoLink, styles.promoCardShadow)}
    >
      <Card style={styles.promoCard}>
        {listing.heroImageUrl ? (
          <CardImage
            aspectRatio={16 / 9}
            alt={getDirectoryListingHeroImageAlt(listing)}
            src={listing.heroImageUrl}
          />
        ) : null}
        <Flex direction="column" gap="4xl" style={styles.promoCardBody}>
          <Flex align="center" gap="2xl">
            <StoreIcon listing={listing} size="xl" />
            <Flex direction="column" gap="xl">
              <Text
                size={{ default: "2xl", sm: "3xl" }}
                weight="semibold"
                style={styles.heroTitle}
              >
                {listing.name}
              </Text>
              <SmallBody variant="secondary">
                @{listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
              </SmallBody>
            </Flex>
          </Flex>
          <Text
            size="lg"
            variant="secondary"
            style={[styles.heroDescription, styles.promoCardTagline]}
          >
            {listing.tagline}
          </Text>
          <Flex align="center" justify="end" gap="xl">
            <ChevronRight />
          </Flex>
        </Flex>
      </Card>
    </RouterLink>
  );
}

function ListingCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.bentoLink, styles.listingCardLink)}
    >
      <Card style={styles.listingCard}>
        <Flex direction="column" gap="4xl" style={styles.listingCardContent}>
          <Flex align="center" gap="2xl">
            <StoreIcon listing={listing} size="xl" />
            <Flex direction="column" gap="xl">
              <Text size="xl" weight="semibold">
                {listing.name}
              </Text>
              <SmallBody variant="secondary">
                @{listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
              </SmallBody>
            </Flex>
          </Flex>
          <Body variant="secondary" style={styles.listItemTagline}>
            {listing.tagline}
          </Body>
          <Flex align="center" justify="end" gap="xl">
            <ChevronRight />
          </Flex>
        </Flex>
      </Card>
    </RouterLink>
  );
}

function StoreIcon({
  listing,
  size,
}: {
  listing: DirectoryListingCard;
  size: "lg" | "xl";
}) {
  return (
    <Avatar
      alt={listing.name}
      fallback={getInitials(listing.name)}
      size={size}
      src={listing.iconUrl || undefined}
    />
  );
}

function getListingMetadataLabel(listing: DirectoryListingCard) {
  const categoryLabel = formatMetadataLabel(listing.category);
  const listingName = formatMetadataLabel(listing.name);

  if (
    categoryLabel.trim().length === 0 ||
    categoryLabel.localeCompare(listingName, undefined, {
      sensitivity: "base",
    }) === 0
  ) {
    return "App";
  }

  return categoryLabel;
}

function formatMetadataLabel(value: string) {
  const normalized = value
    .trim()
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ");
  if (normalized.length === 0) {
    return value;
  }

  const shouldTitleCase =
    /[_-]/.test(value) ||
    value === value.toLowerCase() ||
    value === value.toUpperCase();

  if (!shouldTitleCase) {
    return normalized;
  }

  return normalized
    .split(" ")
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
