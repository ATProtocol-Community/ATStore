import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  useNavigate,
} from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

import { AppTagCard } from "../components/AppTagCard";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { HeroImage } from "../components/HeroImage";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { Alert } from "../design-system/alert";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card, CardImage } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
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
import { i18next } from "../i18n";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { buildRouteOgMeta } from "../lib/og-meta";

export const Route = createFileRoute("/$locale/")({
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
  head: ({ params }) => {
    const t = i18next.getFixedT(params.locale, "home");
    return buildRouteOgMeta({
      title: t("ogTitle"),
      description: t("ogDescription"),
    });
  },
  component: HomePageRoute,
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
    color: uiColor.text2,
    display: "block",
    position: "relative",
    zIndex: 1,
  },
  bentoLinkFeatured: {
    aspectRatio: "16 / 9",
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

    "::before": {
      inset: 0,
      borderRadius: radius.lg,
      cornerShape: "squircle",
      boxShadow: shadow.lg,
      content: "''",
      opacity: {
        default: 0,
        ":hover": 1,
      },
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

    "::before": {
      inset: 0,
      borderRadius: radius.lg,
      cornerShape: "squircle",
      boxShadow: shadow.lg,
      content: "''",
      opacity: {
        default: 0,
        ":hover": 1,
      },
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

    "::after": {
      inset: 0,
      borderRadius: radius.md,
      boxShadow: shadow.lg,
      content: "''",
      opacity: {
        default: 0,
        ":hover": 1,
      },
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
    boxShadow: shadow.none,
    boxSizing: "border-box",
    position: "relative",
    height: "100%",
  },
  listingCardContent: {
    boxSizing: "border-box",
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
  heroImagePlaceholder: {
    flexGrow: 1,
    minHeight: 0,
  },
  heroCardContent: {
    height: "100%",
  },
});

function HomePageRoute() {
  return (
    <HeaderLayout.Root>
      <HeaderLayout.Header>
        <SiteHeader />
      </HeaderLayout.Header>

      <HeaderLayout.Page>
        <Suspense>
          <HomePage />
        </Suspense>
      </HeaderLayout.Page>

      <HeaderLayout.Footer>
        <SiteFooter />
      </HeaderLayout.Footer>
    </HeaderLayout.Root>
  );
}

function HomePage() {
  const { t } = useTranslation("home");
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
            title={t("claimBanner.title", { count: claimCount })}
            action={
              <Button
                variant="primary"
                size="sm"
                onPress={() => void navigate({ to: "/product/claim" })}
              >
                {t("claimBanner.continue")}
              </Button>
            }
          >
            {t("claimBanner.body", {
              count: claimCount,
              name:
                (claimEligibility.listings[0]?.name ?? "").trim() || "Listing",
            })}
          </Alert>
        ) : null}

        <Flex direction="column" gap="6xl" style={styles.pageHeader}>
          <Flex direction="column" gap="5xl">
            <Text size="lg" weight="normal" style={styles.eyebrow}>
              {t("hero.eyebrow")}
            </Text>
            <Heading1>{t("hero.title")}</Heading1>
          </Flex>
          <Text
            variant="secondary"
            size={{ default: "xl", sm: "2xl" }}
            leading="sm"
            style={styles.headerDescription}
          >
            {t("hero.description")}
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
            eyebrow={t("browseSection.eyebrow")}
            title={t("browseSection.title")}
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
            eyebrow={t("popularSection.eyebrow")}
            title={t("popularSection.title")}
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
            eyebrow={t("newSection.eyebrow")}
            title={t("newSection.title")}
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
  const { t } = useTranslation("home");
  let action: React.ReactNode;

  switch (to) {
    case "/apps/all": {
      action = (
        <AppLink to="/apps/all" search={search}>
          {t("sectionHeader.seeAll")} <ChevronRight />
        </AppLink>
      );
      break;
    }
    case "/apps/tags": {
      action = (
        <AppLink to="/apps/tags">
          {t("sectionHeader.seeAll")} <ChevronRight />
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
      {...stylex.props(styles.bentoLink, stylex.defaultMarker())}
    >
      {listing.heroImageUrl ? (
        <div {...stylex.props(styles.heroImagePlaceholder)}>
          <HeroImage
            alt={getDirectoryListingHeroImageAlt(listing)}
            glowIntensity={0}
            src={listing.heroImageUrl}
          />
        </div>
      ) : (
        <Card size="lg" style={styles.bentoLinkFeatured}>
          <Flex direction="column" gap="4xl" style={styles.heroCardContent}>
            <Flex
              direction="column"
              gap="4xl"
              style={styles.listingCardContent}
            >
              <Flex align="center" gap="2xl">
                <StoreIcon listing={listing} size="xl" />
                <Flex direction="column" gap="xl">
                  <Text size="3xl" weight="semibold">
                    {listing.name}
                  </Text>
                  <Text size="lg" variant="secondary">
                    @
                    {listing.productAccountHandle?.replace(/^@/, "") ||
                      "unknown"}
                  </Text>
                </Flex>
              </Flex>
              <Body variant="secondary" style={styles.listItemTagline}>
                {listing.tagline}
              </Body>
            </Flex>
          </Flex>
        </Card>
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
  const { t } = useTranslation("home");
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
        {t("popularItem.explore")}
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
