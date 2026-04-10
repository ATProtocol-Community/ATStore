import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link as RouterLink,
  notFound,
  createLink,
} from "@tanstack/react-router";
import {
  ChevronLeft,
  AppWindow,
  BarChart3,
  Code2,
  RadioTower,
  type LucideIcon,
} from "lucide-react";

import { AppTagHero } from "../components/AppTagHero";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { indigo as green } from "../design-system/theme/colors/indigo.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getDirectoryBrowsePath,
  getAppSegmentFromEcosystemRootCategoryId,
  type DirectoryCategoryAccent,
  type DirectoryCategoryTreeNode,
} from "../lib/directory-categories";
import { getCategoryBentoArtSpec } from "../lib/category-bento-art";
import { getEcosystemHeroAssetPathForCategory } from "../lib/ecosystem-hero-art";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { StarRating } from "#/design-system/star-rating";

const AppLink = createLink(Link);

export const Route = createFileRoute("/categories/$categoryId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryCategoryPageQueryOptions({
        categoryId: params.categoryId,
      }),
    );

    if (!data) {
      throw notFound();
    }

    return params;
  },
  component: CategoryPage,
});

const styles = stylex.create({
  listingAvatar: {
    borderRadius: radius["lg"],
  },
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  pageContent: {
    gap: {
      default: gap["6xl"],
      [breakpoints.xl]: gap["8xl"],
    },
  },
  navLinks: {
    flexWrap: "wrap",
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  childGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  childCardLink: {
    display: "block",
    textDecoration: "none",
  },
  childCard: {
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.lg,
    color: "white",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    gap: gap["3xl"],
    minHeight: "12rem",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  childIcon: {
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
  childDescription: {
    color: uiColor.textContrast,
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
    width: "100%",
    boxSizing: "border-box",
    paddingTop: verticalSpace["2xl"],
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
    borderRadius: radius["2xl"],
  },
  listingCardFeatured: {
    borderRadius: radius["3xl"],
    borderStyle: "solid",
    borderWidth: 1,
    color: uiColor.text2,
    cornerShape: "squircle",
    overflow: "hidden",
    position: "relative",
    boxShadow: shadow["2xl"],
  },
  listingCardBody: {
    gap: gap["4xl"],
    height: "100%",
    paddingBottom: verticalSpace["xl"],
    paddingLeft: horizontalSpace["xl"],
    paddingRight: horizontalSpace["xl"],
    paddingTop: verticalSpace["xl"],
    position: "relative",
  },
  listingCardBodyFeatured: {
    gap: gap["3xl"],
    height: "100%",
    justifyContent: "flex-end",
    paddingBottom: verticalSpace["md"],
    paddingLeft: horizontalSpace["md"],
    paddingRight: horizontalSpace["md"],
    paddingTop: verticalSpace["md"],
    position: "relative",
    zIndex: 1,
  },
  listingHeader: {
    gap: gap["2xl"],
    position: "relative",
    zIndex: 1,
  },
  listingInfo: {
    flex: 1,
    minWidth: 0,
  },
  listingTagline: {
    flexGrow: 1,
  },
  featuredImageFrame: {
    height: "100%",
    inset: 0,
    objectFit: "cover",
    position: "absolute",
    width: "100%",
  },
  accentOverlay: {
    background: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 12%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 48%, transparent) 46%, color-mix(in srgb, ${uiColor.overlayBackdrop} 100%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
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
  blurContainer: {
    inset: 0,
    overflow: "hidden",
    position: "absolute",
    zIndex: 0,
  },
  blur: {
    backdropFilter: "blur(32px) saturate(500%)",
    position: "absolute",
    bottom: -48,
    left: -48,
    right: -48,
    top: -48,
  },
  featuredInfoPanel: {
    backdropFilter: "blur(18px) saturate(180%)",
    backgroundColor:
      "light-dark(rgba(255, 252, 255, 0.55), rgba(252, 252, 252, 0.4))",
    borderColor: `color-mix(in srgb, ${uiColor.border1} 60%, transparent)`,
    borderRadius: radius["xl"],
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: `${shadow.lg}, 0 18px 48px color-mix(in srgb, ${uiColor.overlayBackdrop} 42%, transparent)`,
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
    height: "fit-content",
    overflow: "hidden",
    maxWidth: "34rem",
    position: "relative",
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
    paddingBottom: verticalSpace["4xl"],
  },
  featuredAvatarContainer: {
    height: "100%",
    aspectRatio: 1 / 1,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  featuredAvatar: {
    position: "absolute",
    inset: 0,
    height: "100%",
    width: "100%",
  },
  featuredInfoContent: {
    position: "relative",
    zIndex: 1,
    paddingTop: verticalSpace["4xl"],
    paddingBottom: verticalSpace["4xl"],
  },
  featuredTitle: {
    display: "block",
    maxWidth: "18ch",
  },
  featuredTagline: {
    color: uiColor.text1,
    margin: 0,
    maxWidth: "32rem",
    position: "relative",
    zIndex: 1,
  },
  listingFooter: {
    alignItems: "center",
  },
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
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
});

function CategoryPage() {
  const params = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryPageQueryOptions({
      categoryId: params.categoryId,
    }),
  );

  if (!data) {
    throw notFound();
  }

  const category = data.category;
  const categoryImageSrc =
    getEcosystemHeroAssetPathForCategory(category.id) ??
    getCategoryBentoArtSpec(category.label)?.assetPath ??
    null;
  const browsePath = getDirectoryBrowsePath(category.id);
  const [, AppName] = category.pathLabels;
  const appSegment =
    category.pathIds[0] === "apps" && category.pathIds[1]
      ? getAppSegmentFromEcosystemRootCategoryId(
          `${category.pathIds[0]}/${category.pathIds[1]}`,
        )
      : null;

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large" style={styles.page}>
          <Flex direction="column" style={styles.pageContent}>
            <Flex direction="column" gap="4xl">
              <Flex gap="xl" style={styles.navLinks}>
                {appSegment ? (
                  <AppLink to="/ecosystems/$app" params={{ app: appSegment }}>
                    <ChevronLeft />
                    Back to {AppName} Ecosystem
                  </AppLink>
                ) : (
                  <AppLink to={browsePath as never}>
                    <ChevronLeft />
                    Back to categories
                  </AppLink>
                )}
              </Flex>

              <AppTagHero
                eyebrow={formatCount(category.count)}
                title={category.label}
                description={category.description}
                imageSrc={categoryImageSrc}
              />
            </Flex>

            {data.listings.length > 0 ? (
              <FeaturedListingGrid
                items={data.listings}
                getKey={(listing) => listing.id}
                renderItem={(listing, { featured }) => (
                  <CategoryListingCard featured={featured} listing={listing} />
                )}
              />
            ) : (
              <Flex direction="column" style={styles.emptyState}>
                <Body variant="secondary">
                  No listings are assigned to this branch yet.
                </Body>
                {import.meta.env.DEV ? (
                  <AppLink to="/dev/categories">
                    Open the dev recategorization panel to assign some.
                  </AppLink>
                ) : null}
              </Flex>
            )}

            {category.children.length > 0 ? (
              <Flex direction="column" gap="2xl">
                <Heading1>Subcategories</Heading1>
                <Grid style={styles.childGrid}>
                  {category.children.map((child) => (
                    <ChildCategoryCard key={child.id} category={child} />
                  ))}
                </Grid>
              </Flex>
            ) : null}
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function ChildCategoryCard({
  category,
}: {
  category: DirectoryCategoryTreeNode;
}) {
  const CategoryIcon = getCategoryIcon(category.label);

  return (
    <RouterLink
      to="/categories/$categoryId"
      params={{ categoryId: category.id }}
      {...stylex.props(styles.childCardLink)}
    >
      <div
        {...stylex.props(
          styles.childCard,
          getSoftAccentSurface(category.accent),
        )}
      >
        <div {...stylex.props(styles.childIcon)}>
          <CategoryIcon size={18} strokeWidth={2.25} />
        </div>
        <Flex direction="column" gap="lg">
          <SmallBody style={styles.eyebrow}>
            {category.pathLabels.slice(0, -1).join(" / ")}
          </SmallBody>
          <Text size="2xl" weight="semibold">
            {category.label}
          </Text>
          <Body style={styles.childDescription}>{category.description}</Body>
          <Text weight="semibold">{formatCount(category.count)}</Text>
        </Flex>
      </div>
    </RouterLink>
  );
}

function CategoryListingCard({
  listing,
  featured = false,
}: {
  listing: DirectoryListingCard;
  featured?: boolean;
}) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.listingLink)}
    >
      <Card
        style={[
          styles.listingCard,
          featured && styles.listingCardFeatured,
          featured && getAccentSurface(listing.accent),
        ]}
      >
        {featured && listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt=""
            aria-hidden="true"
            {...stylex.props(styles.featuredImageFrame)}
          />
        ) : null}
        <div {...stylex.props(styles.ambientGlow)}>
          <div
            {...stylex.props(
              styles.ambientGlowInner,
              getAccentGlow(listing.accent),
            )}
          />
        </div>
        <Flex
          direction="column"
          style={[
            styles.listingCardBody,
            featured && styles.listingCardBodyFeatured,
          ]}
        >
          {featured ? (
            <Flex direction="column" gap="4xl" style={styles.featuredInfoPanel}>
              <div {...stylex.props(styles.blurContainer)}>
                <div {...stylex.props(styles.blur)} />
              </div>

              <Flex gap="2xl" align="center" style={styles.listingHeader}>
                <div {...stylex.props(styles.featuredAvatarContainer)}>
                  <Avatar
                    alt={listing.name}
                    fallback={getInitials(listing.name)}
                    size="xl"
                    src={listing.iconUrl || undefined}
                    style={styles.featuredAvatar}
                  />
                </div>
                <Flex
                  direction="column"
                  gap="2xl"
                  style={styles.featuredInfoContent}
                >
                  <Text
                    font="title"
                    size={{ default: "4xl", sm: "6xl" }}
                    weight="semibold"
                    style={styles.featuredTitle}
                  >
                    {listing.name}
                  </Text>
                  <Body style={styles.featuredTagline}>{listing.tagline}</Body>
                </Flex>
              </Flex>
            </Flex>
          ) : (
            <>
              <Flex gap="2xl" align="center" style={styles.listingHeader}>
                <Avatar
                  alt={listing.name}
                  fallback={getInitials(listing.name)}
                  size="xl"
                  src={listing.iconUrl || undefined}
                  style={styles.listingAvatar}
                />
                <Flex direction="column" gap="md" style={styles.listingInfo}>
                  <Text size="xl" weight="semibold">
                    {listing.name}
                  </Text>
                  <Flex align="center" gap="lg">
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
            </>
          )}
        </Flex>
      </Card>
    </RouterLink>
  );
}

function getCategoryIcon(label: string): LucideIcon {
  if (label === "Analytics") return BarChart3;
  if (label === "Protocol" || label === "Tools") return Code2;
  if (label === "PDS" || label === "AppView") return RadioTower;

  return AppWindow;
}

function getSoftAccentSurface(accent: DirectoryCategoryAccent) {
  if (accent === "pink") return styles.softPinkSurface;
  if (accent === "purple") return styles.softPurpleSurface;
  if (accent === "green") return styles.softGreenSurface;

  return styles.softBlueSurface;
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

function formatCount(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
