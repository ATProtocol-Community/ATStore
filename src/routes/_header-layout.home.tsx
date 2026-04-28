import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  useNavigate,
} from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Link as RouterLink } from "@tanstack/react-router";

import { AppTagCard } from "../components/AppTagCard";
import { HeroImage } from "../components/HeroImage";
import { FeaturedListingFallbackCard } from "../components/FeaturedListingFallbackCard";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { Alert } from "../design-system/alert";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { indigo as green } from "../design-system/theme/colors/indigo.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { ui } from "../design-system/theme/semantic-color.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  Body,
  Heading1,
  Heading2,
  SmallBody,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getHomePageHeroArtSpec } from "../lib/home-page-hero-art";
import { buildRouteOgMeta } from "../lib/og-meta";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { StarRating } from "../design-system/star-rating";

export const Route = createFileRoute("/_header-layout/home")({
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
        "Discover apps and tools across the Atmosphere. Find you next favorite app today!",
      image: getHomePageHeroArtSpec("home-og")?.assetPath,
    }),
  component: HomePage,
});

const AppLink = createLink(Link);

const styles = stylex.create({
  sectionHeaderAction: {
    flexShrink: 0,
  },
  protocolHeader: {
    paddingTop: verticalSpace["8xl"],
  },
  headerDescription: {
    maxWidth: "41rem",
  },
  bentoLink: {
    textDecoration: "none",
    display: "block",
    height: "100%",
    position: "relative",
    zIndex: 1,
  },
  bentoLinkFeatured: {
    zIndex: 0,
  },
  newCardLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
  },
  promoRatingRow: {
    marginBottom: verticalSpace["2xl"],
  },
  categoryCardContent: {
    flexGrow: 1,
    position: "relative",
    zIndex: 1,
  },
  categoryCardImage: {
    height: "100%",
    inset: 0,
    objectFit: "cover",
    opacity: 0.78,
    position: "absolute",
    width: "100%",
  },
  categoryCardOverlay: {
    background: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 18%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 46%, transparent) 48%, color-mix(in srgb, ${uiColor.overlayBackdrop} 88%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
  },
  categoryCardFooter: {
    position: "relative",
    zIndex: 1,
  },
  categoryDescription: {
    color: uiColor.textContrast,
  },
  compactCardContentText: {
    flexGrow: 1,
    fontSize: fontSize["base"],
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
  shellHeader: {
    backdropFilter: "blur(24px) saturate(180%)",
    backgroundColor: `color-mix(in srgb, ${uiColor.bg} 82%, transparent)`,
    borderBottomColor: `color-mix(in srgb, ${uiColor.border1} 60%, transparent)`,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  shellHeaderContent: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    maxWidth: "var(--page-content-max-width)",
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["2xl"],
    width: "100%",
  },
  shellHeaderText: {
    minWidth: 0,
  },
  shellHeaderTitle: {
    display: "block",
  },
  shellHeaderDescription: {
    maxWidth: "42rem",
  },
  pageSections: {
    gap: {
      default: 40,
      [breakpoints.sm]: 64,
    },
  },
  section: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: gap["2xl"],
  },
  accentCard: {
    borderRadius: radius["3xl"],
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    overflow: "hidden",
    position: "relative",
  },
  heroCard: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    boxShadow: shadow["2xl"],
    height: "100%",
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 2,
  },
  spotlightCard: {
    boxShadow: shadow.xl,
    height: "100%",
    borderRadius: radius["xl"],
    transitionProperty: "transform",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease-in-out",
    transform: {
      default: "none",
      ":hover": "translateY(-2px)",
    },
  },
  promoCard: {
    boxShadow: shadow.xl,
    color: uiColor.text2,
    height: "100%",
    borderRadius: radius["lg"],
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: uiColor.border1,
    transitionProperty: "transform",
    transitionDuration: "0.2s",
    transitionTimingFunction: "ease-in-out",
    transform: {
      default: "none",
      ":hover": "translateY(-2px)",
    },
  },
  accentOverlay: {
    background: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 12%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 48%, transparent) 46%, color-mix(in srgb, ${uiColor.overlayBackdrop} 100%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
  },
  heroOverlay: {
    background: `linear-gradient(90deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 88%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 78%, transparent) 34%, color-mix(in srgb, ${uiColor.overlayBackdrop} 38%, transparent) 68%, color-mix(in srgb, ${uiColor.overlayBackdrop} 16%, transparent) 100%), linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 20%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 18%, transparent) 32%, color-mix(in srgb, ${uiColor.overlayBackdrop} 96%, transparent) 100%)`,
  },
  ambientGlow: {
    filter: "blur(12px)",
    opacity: 0.55,
    position: "absolute",
    right: "-3rem",
    top: "-2rem",
  },
  ambientGlowInner: {
    borderRadius: radius.full,
    height: "9rem",
    width: "9rem",
  },
  cardContent: {
    display: "flex",
    flexDirection: "column",
    gap: gap["3xl"],
    height: "100%",
    justifyContent: "flex-end",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
    position: "relative",
    zIndex: 1,
  },
  heroContent: {
    maxWidth: "34rem",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in srgb, ${uiColor.overlayBackdrop} 48%, transparent)`,
    borderRadius: radius["xl"],
    height: "fit-content",
    margin: verticalSpace["2xl"],
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
  },
  compactCardContent: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    justifyContent: "flex-start",
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
    position: "relative",
    zIndex: 1,
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  heroIntro: {},
  heroTitle: {
    display: "block",
    maxWidth: "18ch",
  },
  heroDescription: {
    margin: 0,
    maxWidth: "32rem",
  },
  heroMetaRow: {
    flexWrap: "wrap",
  },
  protocolLinks: {
    flexWrap: "wrap",
  },
  sectionHeader: {
    marginBottom: verticalSpace["3xl"],
  },
  sectionHeaderText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: gap["2xl"],
  },
  categoriesGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
  },
  categoryCard: {
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.lg,
    color: "white",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["4xl"],
    position: "relative",
    textDecoration: "none",
    gap: gap["8xl"],
    overflow: "hidden",
  },
  categoryIcon: {
    alignItems: "center",
    backdropFilter: "blur(10px)",
    backgroundColor: `color-mix(in srgb, ${uiColor.component1} 36%, transparent)`,
    borderColor: `color-mix(in srgb, ${uiColor.border1} 65%, transparent)`,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    display: "inline-flex",
    height: "2.5rem",
    justifyContent: "center",
    width: "2.5rem",
  },
  categoryChevron: {
    marginLeft: "auto",
  },
  popularGrid: {
    display: "grid",
    gap: gap["3xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.lg]: "minmax(0, 1.2fr) minmax(18rem, 0.9fr)",
    },
  },
  listCard: {
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
  },
  listItem: {
    alignItems: "center",
    borderRadius: radius.md,
    display: "flex",
    gap: gap["2xl"],
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: uiColor.border1,
    backgroundColor: uiColor.bg,
    boxShadow: shadow.lg,
    textDecoration: "none",
    color: uiColor.text2,
  },
  rankNumber: {
    minWidth: "1.25rem",
  },
  listItemText: {
    flex: 1,
    minWidth: 0,
  },
  ratingRow: {
    alignItems: "center",
    flexGrow: 1,
  },
  newGrid: {
    display: "grid",
    gap: gap["lg"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  newCard: {
    height: "100%",
  },
  newCardContent: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  spacer: {
    flex: 1,
  },
  dock: {
    backdropFilter: "blur(18px)",
    backgroundColor: `color-mix(in srgb, ${uiColor.bg} 84%, transparent)`,
    borderColor: `color-mix(in srgb, ${uiColor.border1} 60%, transparent)`,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: `${shadow.lg}, 0 18px 48px color-mix(in srgb, ${uiColor.overlayBackdrop} 42%, transparent)`,
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["sm"],
    paddingLeft: horizontalSpace["sm"],
    paddingRight: horizontalSpace["sm"],
    paddingTop: verticalSpace["sm"],
    width: "fit-content",
  },
  dockButton: {
    minWidth: "4.5rem",
  },
  blueSurface: {
    backgroundImage: `linear-gradient(135deg, ${blue.solid1} 0%, ${blue.solid2} 45%, ${blue.border3} 100%)`,
    borderColor: blue.border1,
  },
  pinkSurface: {
    backgroundImage: `linear-gradient(135deg, ${pink.solid1} 0%, ${pink.solid2} 45%, ${purple.solid1} 100%)`,
    borderColor: pink.border1,
  },
  purpleSurface: {
    backgroundImage: `linear-gradient(135deg, ${purple.solid1} 0%, ${purple.solid2} 45%, ${pink.border3} 100%)`,
    borderColor: purple.border1,
  },
  greenSurface: {
    backgroundImage: `linear-gradient(135deg, ${green.solid1} 0%, ${green.solid2} 45%, ${green.border3} 100%)`,
    borderColor: green.border1,
  },
  blueGlow: {
    backgroundImage: `radial-gradient(circle, ${blue.component3}, transparent 70%)`,
  },
  pinkGlow: {
    backgroundImage: `radial-gradient(circle, ${pink.component3}, transparent 70%)`,
  },
  purpleGlow: {
    backgroundImage: `radial-gradient(circle, ${purple.component3}, transparent 70%)`,
  },
  greenGlow: {
    backgroundImage: `radial-gradient(circle, ${green.component3}, transparent 70%)`,
  },
  softBlueSurface: {
    backgroundImage: `linear-gradient(135deg, ${blue.border2} 0%, ${blue.solid1} 100%)`,
    borderColor: blue.border1,
  },
  softPinkSurface: {
    backgroundImage: `linear-gradient(135deg, ${pink.border2} 0%, ${pink.solid1} 100%)`,
    borderColor: pink.border1,
  },
  softPurpleSurface: {
    backgroundImage: `linear-gradient(135deg, ${purple.border2} 0%, ${purple.solid1} 100%)`,
    borderColor: purple.border1,
  },
  softGreenSurface: {
    backgroundImage: `linear-gradient(135deg, ${green.border2} 0%, ${green.solid1} 100%)`,
    borderColor: green.border1,
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
  const promoListing = data.spotlights[0] || data.featured;

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
              ? `“${claimEligibility.listings[0]!.name}” is still on the store repo. Claim it to manage updates from your PDS.`
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
                <SpotlightCard listing={listing} />
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
          <Grid style={styles.popularGrid}>
            <Flex direction="column" gap="md">
              {data.popular.map((listing, index) => (
                <PopularListItem
                  key={listing.id}
                  listing={listing}
                  rank={index + 1}
                />
              ))}
            </Flex>
            <PromoCard listing={promoListing} />
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
              <NewListingCard key={listing.id} listing={listing} />
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
    case "/apps/all":
      action = (
        <AppLink to="/apps/all" search={search}>
          See All <ChevronRight />
        </AppLink>
      );
      break;
    case "/apps/tags":
      action = (
        <AppLink to="/apps/tags">
          See All <ChevronRight />
        </AppLink>
      );
      break;
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
          alt={`${listing.name} preview`}
          glowIntensity={0.8}
          src={listing.heroImageUrl}
        />
      ) : (
        <FeaturedListingFallbackCard listing={listing} />
      )}
    </RouterLink>
  );
}

function SpotlightCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.bentoLink)}
    >
      <Card style={[styles.accentCard, styles.spotlightCard]}>
        <Flex direction="column" gap="2xl" style={styles.compactCardContent}>
          <SmallBody style={styles.eyebrow}>
            {getListingMetadataLabel(listing)}
          </SmallBody>
          <Flex
            direction="column"
            gap="4xl"
            style={styles.compactCardContentText}
          >
            <Text
              size={{ default: "xl", sm: "2xl" }}
              weight="semibold"
              style={styles.heroTitle}
            >
              {listing.name}
            </Text>
            <Body style={styles.heroDescription}>{listing.tagline}</Body>
          </Flex>
          <Flex align="center" justify="between" gap="xl">
            <StoreIcon listing={listing} size="lg" />
            <Button variant="secondary" style={styles.exploreButton}>
              Explore
            </Button>
          </Flex>
        </Flex>
      </Card>
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
      {...stylex.props(styles.listItem, ui.bgSubtle)}
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
      <Button size="lg" variant="secondary">
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
      {...stylex.props(styles.bentoLink, styles.promoCard)}
    >
      <Flex direction="column" gap="5xl" style={styles.compactCardContent}>
        <SmallBody style={styles.eyebrow}>Trending</SmallBody>
        <Flex direction="column" gap="2xl">
          <Text
            size={{ default: "2xl", sm: "4xl" }}
            weight="semibold"
            style={styles.heroTitle}
          >
            {listing.name}
          </Text>
          <Body style={styles.heroDescription}>{listing.tagline}</Body>
        </Flex>
        <div {...stylex.props(styles.ratingRow)}>
          <Flex align="center" gap="md">
            <Text weight="semibold">
              {listing.rating != null ? listing.rating.toFixed(1) : "—"}
            </Text>
            <SmallBody style={styles.heroDescription}>
              {getListingMetadataLabel(listing)}
            </SmallBody>
          </Flex>
        </div>
        <Flex align="center" justify="between" gap="xl">
          <StoreIcon listing={listing} size="lg" />
          <Button size="lg" variant="secondary">
            Explore
          </Button>
        </Flex>
      </Flex>
    </RouterLink>
  );
}

function NewListingCard({ listing }: { listing: DirectoryListingCard }) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.bentoLink, styles.newCardLink)}
    >
      <Card style={styles.newCard}>
        <Flex direction="column" gap="4xl" style={styles.newCardContent}>
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
          <Body variant="secondary">{listing.tagline}</Body>
          <div {...stylex.props(styles.spacer)} />
          <Flex align="center" justify="end" gap="xl">
            <Flex align="center" gap="sm">
              <Text size="sm" weight="semibold">
                {listing.rating != null ? listing.rating.toFixed(1) : "—"}
              </Text>
              <StarRating
                rating={listing.rating}
                reviewCount={listing.reviewCount}
                showReviewCount
              />
            </Flex>
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
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
  const normalized = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
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

function getAccentSurface(accent: DirectoryListingCard["accent"]) {
  if (accent === "pink") return styles.pinkSurface;
  if (accent === "purple") return styles.purpleSurface;
  if (accent === "green") return styles.greenSurface;

  return styles.blueSurface;
}

function getAccentGlow(accent: DirectoryListingCard["accent"]) {
  if (accent === "pink") return styles.pinkGlow;
  if (accent === "purple") return styles.purpleGlow;
  if (accent === "green") return styles.greenGlow;

  return styles.blueGlow;
}
