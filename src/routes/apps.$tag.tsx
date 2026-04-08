import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link as RouterLink,
  notFound,
} from "@tanstack/react-router";

import { AppTagHero } from "../components/AppTagHero";
import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { green } from "../design-system/theme/colors/green.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
import { primaryColor, uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagCount,
  formatAppTagLabel,
  getAppTagDescription,
} from "../lib/app-tag-metadata";
import { getAppTagHeroAssetPathForTag } from "../lib/app-tag-hero-art";
import { ChevronLeft } from "lucide-react";
import { StarRating } from "#/design-system/star-rating";
import { gold } from "../design-system/theme/colors/gold.stylex";

const starTheme = stylex.createTheme(primaryColor, {
  solid1: gold.solid1,
  solid2: gold.solid2,
});

export const Route = createFileRoute("/apps/$tag")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getAppsByTagPageQueryOptions({
        tag: params.tag,
      }),
    );

    if (!data) {
      throw notFound();
    }

    return params;
  },
  component: AppsTagPage,
});

const styles = stylex.create({
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
  listingGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridAutoFlow: "dense",
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
  listingLinkFeatured: {
    gridColumn: {
      default: "auto",
      [breakpoints.sm]: "span 2",
    },
    gridRow: {
      default: "auto",
      [breakpoints.sm]: "span 2",
    },
  },
  listingCard: {
    height: "100%",
    minHeight: "15rem",
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
    minHeight: {
      default: "20rem",
      [breakpoints.sm]: "32rem",
    },
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
  featuredInfoContent: {
    position: "relative",
    zIndex: 1,
    paddingTop: verticalSpace["4xl"],
    paddingBottom: verticalSpace["4xl"],
  },
  listingInfo: {
    flex: 1,
    minWidth: 0,
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
  featuredInfoPanel: {
    backdropFilter: "blur(18px) saturate(180%)",
    backgroundColor:
      "light-dark(rgba(255, 252, 255, 0.55), rgba(252, 252, 252, 0.4))",
    borderColor: `color-mix(in srgb, ${uiColor.border1} 60%, transparent)`,
    borderRadius: radius["lg"],
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: `${shadow.lg}, 0 18px 48px color-mix(in srgb, ${uiColor.overlayBackdrop} 42%, transparent)`,
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
    height: "fit-content",
    overflow: "hidden",
    margin: verticalSpace["2xl"],
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
  featuredTitle: {
    display: "block",
    maxWidth: "18ch",
  },
  featuredTagline: {
    color: uiColor.text1,
    fontSize: fontSize["lg"],
    margin: 0,
    maxWidth: "32rem",
    position: "relative",
    zIndex: 1,
  },
  listingFooter: {
    alignItems: "center",
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
});

function AppsTagPage() {
  const params = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getAppsByTagPageQueryOptions({
      tag: params.tag,
    }),
  );

  if (!data) {
    throw notFound();
  }

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large" style={styles.page}>
          <Flex direction="column" gap="8xl">
            <Flex direction="column" gap="4xl">
              <Flex gap="xl" style={styles.navLinks}>
                <Link href="/apps/all">
                  <ChevronLeft />
                  All tags
                </Link>
              </Flex>

              <AppTagHero
                eyebrow={formatAppTagCount(data.count)}
                title={formatAppTagLabel(data.tag)}
                description={getAppTagDescription(data.tag)}
                imageSrc={getAppTagHeroAssetPathForTag(data.tag)}
              />
            </Flex>

            <Grid style={styles.listingGrid}>
              {data.listings.map((listing, index) => (
                <AppTagListingCard
                  key={`${data.tag}-${listing.id}`}
                  featured={index === 0}
                  listing={listing}
                />
              ))}
            </Grid>
          </Flex>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function AppTagListingCard({
  listing,
  featured = false,
}: {
  listing: DirectoryListingCard;
  featured?: boolean;
}) {
  console.log(listing);
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: listing.id }}
      {...stylex.props(
        styles.listingLink,
        featured && styles.listingLinkFeatured,
      )}
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
            <>
              <Flex
                direction="column"
                gap="4xl"
                style={styles.featuredInfoPanel}
              >
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
                    <Body style={styles.featuredTagline}>
                      {listing.tagline}
                    </Body>
                  </Flex>
                </Flex>
              </Flex>
            </>
          ) : (
            <>
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
                  <Flex align="center" gap="lg">
                    <SmallBody variant="secondary">
                      {listing.rating.toFixed(1)}
                    </SmallBody>
                    <StarRating rating={listing.rating} style={starTheme} />
                  </Flex>
                </Flex>
              </Flex>
              <Body variant="secondary" style={styles.listingTagline}>
                {listing.tagline}
              </Body>
              <div />
            </>
          )}
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
