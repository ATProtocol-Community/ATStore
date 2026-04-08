import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AppWindow,
  BarChart3,
  Bookmark,
  ChevronRight,
  Code2,
  RadioTower,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Link as RouterLink } from "@tanstack/react-router";

import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
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
  type DirectoryAppTagSummary,
  type DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagCount,
  formatAppTagLabel,
  getAppTagDescription,
  getAppTagSlug,
} from "../lib/app-tag-metadata";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      directoryListingApi.getHomePageQueryOptions,
    ),
  component: HomePage,
});

const styles = stylex.create({
  bentoLink: {
    textDecoration: "none",
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
  },
  categoryDescription: {
    color: uiColor.textContrast,
  },
  compactCardContentText: {
    flexGrow: 1,
    fontSize: fontSize["base"],
  },
  pageHeader: {
    paddingBottom: verticalSpace["11xl"],
    paddingTop: verticalSpace["8xl"],
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
    gap: gap["8xl"],
  },
  section: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: gap["2xl"],
  },
  heroGrid: {
    display: "grid",
    gap: gap["3xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.lg]: "minmax(0, 1.65fr) minmax(18rem, 0.95fr)",
    },
  },
  spotlightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: gap["3xl"],
  },
  accentCard: {
    borderRadius: radius["3xl"],
    borderStyle: "solid",
    borderWidth: 1,
    color: "white",
    cornerShape: "squircle",
    overflow: "hidden",
    position: "relative",
  },
  heroCard: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    boxShadow: shadow["2xl"],
    minHeight: {
      default: "26rem",
      [breakpoints.sm]: "30rem",
    },
  },
  spotlightCardLink: {
    flexGrow: 1,
  },
  spotlightCard: {
    boxShadow: shadow.xl,
    minHeight: "12.5rem",
    height: "100%",
    borderRadius: radius["xl"],
  },
  promoCard: {
    borderRadius: radius["xl"],
    boxShadow: shadow.xl,
    minHeight: "18rem",
  },
  imageLayer: {
    height: "100%",
    inset: 0,
    objectFit: "cover",
    opacity: 0.7,
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
    borderRadius: radius["lg"],
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
    textShadow: `0 10px 30px ${uiColor.overlayBackdrop}`,
  },
  heroDescription: {
    color: uiColor.textContrast,
    margin: 0,
    maxWidth: "32rem",
    textShadow: `0 6px 20px ${uiColor.overlayBackdrop}`,
    fontSize: fontSize["lg"],
  },
  heroMetaRow: {
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
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
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
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
    position: "relative",
    textDecoration: "none",
    gap: gap["3xl"],
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
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
    },
  },
  newCard: {
    minHeight: "13rem",
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
});

function HomePage() {
  const { data } = useSuspenseQuery(
    directoryListingApi.getHomePageQueryOptions,
  );
  const promoListing = data.spotlights[0] || data.featured;

  return (
    <HeaderLayout.Root>
      <HeaderLayout.Page>
        <Page.Root variant="large">
          <Flex direction="column" gap="5xl" style={styles.pageHeader}>
            <Heading1>Apps on the Atmosphere</Heading1>
            <Text variant="secondary" size="2xl">
              Discover standout apps, feeds, and developer tools built for the
              Bluesky ecosystem.
            </Text>
          </Flex>

          <Flex direction="column" style={styles.pageSections}>
            <section {...stylex.props(styles.section)}>
              <Grid style={styles.heroGrid}>
                <HeroCard listing={data.featured} />
                <Flex
                  direction="column"
                  gap="4xl"
                  style={styles.spotlightColumn}
                >
                  {data.spotlights.map((listing) => (
                    <SpotlightCard key={listing.id} listing={listing} />
                  ))}
                </Flex>
              </Grid>
            </section>

            <section {...stylex.props(styles.section)}>
              <SectionHeader
                eyebrow="Browse Apps"
                title="Find apps by workflow"
                href="/apps/all"
              />
              <Grid style={styles.categoriesGrid}>
                {data.tags.map((tag) => (
                  <AppTagCard key={tag.tag} tag={tag} />
                ))}
              </Grid>
            </section>

            <section {...stylex.props(styles.section)}>
              <SectionHeader
                eyebrow="Popular Right Now"
                title="Trending across the Bluesky ecosystem"
                href="/about"
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
                title="Fresh tools just added"
                href="/about"
              />
              <Grid style={styles.newGrid}>
                {data.fresh.map((listing) => (
                  <NewListingCard key={listing.id} listing={listing} />
                ))}
              </Grid>
            </section>
          </Flex>

          <Page.StickyFooter>
            <Flex gap="sm" style={styles.dock}>
              <Button size="lg" variant="secondary" style={styles.dockButton}>
                <Sparkles />
                Today
              </Button>
              <Button size="lg" variant="tertiary" style={styles.dockButton}>
                <AppWindow />
                Apps
              </Button>
              <Button size="lg" variant="tertiary" style={styles.dockButton}>
                <RadioTower />
                Feeds
              </Button>
              <Button size="lg" variant="tertiary" style={styles.dockButton}>
                <Bookmark />
                Saved
              </Button>
            </Flex>
          </Page.StickyFooter>
        </Page.Root>
      </HeaderLayout.Page>
    </HeaderLayout.Root>
  );
}

function SectionHeader({
  eyebrow,
  title,
  href,
}: {
  eyebrow: string;
  title: string;
  href: string;
}) {
  return (
    <Flex
      align="center"
      justify="between"
      gap="2xl"
      style={styles.sectionHeader}
    >
      <div {...stylex.props(styles.sectionHeaderText)}>
        <SmallBody style={styles.eyebrow} variant="secondary">
          {eyebrow}
        </SmallBody>
        <Heading2>{title}</Heading2>
      </div>
      <Link href={href}>
        See All <ChevronRight />
      </Link>
    </Flex>
  );
}

function HeroCard({ listing }: { listing: DirectoryListingCard }) {
  const href = getListingHref(listing.id);

  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: listing.id }}
      {...stylex.props(styles.bentoLink)}
    >
      <Card
        style={[
          styles.accentCard,
          styles.heroCard,
          getAccentSurface(listing.accent),
        ]}
      >
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt=""
            {...stylex.props(styles.imageLayer)}
          />
        ) : null}
        <div {...stylex.props(styles.accentOverlay, styles.heroOverlay)} />
        <div {...stylex.props(styles.ambientGlow)}>
          <div
            {...stylex.props(
              styles.ambientGlowInner,
              getAccentGlow(listing.accent),
            )}
          />
        </div>
        <div {...stylex.props(styles.cardContent, styles.heroContent)}>
          <Flex direction="column" gap="2xl" style={styles.heroIntro}>
            <Badge size="sm" variant="primary">
              Featured Extension
            </Badge>
            <Text
              font="title"
              size={{ default: "4xl", sm: "6xl" }}
              weight="semibold"
              style={styles.heroTitle}
            >
              {listing.name}
            </Text>
            <Body style={styles.heroDescription}>{listing.tagline}</Body>
          </Flex>
          <Flex direction="column" gap="2xl">
            <Flex gap="md" align="center" style={styles.heroMetaRow}>
              <Button size="xl" variant="secondary" href={href}>
                {listing.priceLabel}
              </Button>
            </Flex>
          </Flex>
        </div>
      </Card>
    </RouterLink>
  );
}

function SpotlightCard({ listing }: { listing: DirectoryListingCard }) {
  const href = getListingHref(listing.id);

  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: listing.id }}
      {...stylex.props(styles.bentoLink, styles.spotlightCardLink)}
    >
      <Card
        style={[
          styles.accentCard,
          styles.spotlightCard,
          getAccentSurface(listing.accent),
        ]}
      >
        <div {...stylex.props(styles.accentOverlay)} />
        <div {...stylex.props(styles.ambientGlow)}>
          <div
            {...stylex.props(
              styles.ambientGlowInner,
              getAccentGlow(listing.accent),
            )}
          />
        </div>
        <Flex direction="column" gap="2xl" style={styles.compactCardContent}>
          <SmallBody style={styles.eyebrow}>
            {formatMetadataLabel(listing.category)}
          </SmallBody>
          <Flex
            direction="column"
            gap="4xl"
            style={styles.compactCardContentText}
          >
            <Text
              size={{ default: "2xl", sm: "3xl" }}
              weight="semibold"
              style={styles.heroTitle}
            >
              {listing.name}
            </Text>
            <Body style={styles.heroDescription}>{listing.tagline}</Body>
          </Flex>
          <Flex align="center" justify="between" gap="xl">
            <StoreIcon listing={listing} size="lg" />
            <Button size="lg" variant="secondary" href={href}>
              {listing.priceLabel}
            </Button>
          </Flex>
        </Flex>
      </Card>
    </RouterLink>
  );
}

function AppTagCard({ tag }: { tag: DirectoryAppTagSummary }) {
  const TagIcon = getAppTagIcon(tag.tag);
  const accent = getAppTagAccent(tag.tag);

  return (
    <RouterLink
      to="/apps/$tag"
      params={{ tag: getAppTagSlug(tag.tag) }}
      {...stylex.props(styles.categoryCard, getSoftAccentSurface(accent))}
    >
      <Flex direction="column" gap="2xl" style={styles.categoryCardContent}>
        <div {...stylex.props(styles.categoryIcon)}>
          <TagIcon size={18} strokeWidth={2.25} />
        </div>
        <Text size="2xl" weight="semibold" style={styles.heroTitle}>
          {formatAppTagLabel(tag.tag)}
        </Text>
      </Flex>
      <Flex align="center" justify="between" gap="md" style={styles.spacer}>
        <SmallBody style={styles.eyebrow}>
          {formatAppTagCount(tag.count)}
        </SmallBody>
        <ChevronRight {...stylex.props(styles.categoryChevron)} />
      </Flex>
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
  const href = getListingHref(listing.id);

  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: listing.id }}
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
      <Button size="lg" variant="secondary" href={href}>
        {listing.priceLabel}
      </Button>
    </RouterLink>
  );
}

function PromoCard({ listing }: { listing: DirectoryListingCard }) {
  const href = getListingHref(listing.id);

  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: listing.id }}
      {...stylex.props(
        styles.bentoLink,
        styles.accentCard,
        styles.promoCard,
        getAccentSurface(listing.accent),
      )}
    >
      <div {...stylex.props(styles.accentOverlay)} />
      <div {...stylex.props(styles.ambientGlow)}>
        <div
          {...stylex.props(
            styles.ambientGlowInner,
            getAccentGlow(listing.accent),
          )}
        />
      </div>
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
            <Text weight="semibold">{listing.rating.toFixed(1)}</Text>
            <SmallBody style={styles.heroDescription}>
              {formatMetadataLabel(listing.category)}
            </SmallBody>
          </Flex>
        </div>
        <Flex align="center" justify="between" gap="xl">
          <StoreIcon listing={listing} size="lg" />
          <Button size="lg" variant="secondary" href={href}>
            {listing.priceLabel}
          </Button>
        </Flex>
      </Flex>
    </RouterLink>
  );
}

function NewListingCard({ listing }: { listing: DirectoryListingCard }) {
  const href = getListingHref(listing.id);

  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: listing.id }}
      {...stylex.props(styles.bentoLink, styles.newCardLink)}
    >
      <Card style={styles.newCard}>
        <Flex direction="column" gap="4xl" style={styles.newCardContent}>
          <StoreIcon listing={listing} size="xl" />
          <Flex direction="column" gap="xl">
            <Text size="xl" weight="semibold" style={styles.heroTitle}>
              {listing.name}
            </Text>
            <SmallBody variant="secondary">
              {formatMetadataLabel(listing.category)}
            </SmallBody>
          </Flex>
          <Body variant="secondary">{listing.tagline}</Body>
          <div {...stylex.props(styles.spacer)} />
          <Flex align="center" justify="between" gap="xl">
            <Flex align="center" gap="sm">
              <Text size="sm" weight="semibold">
                {listing.rating.toFixed(1)}
              </Text>
              <SmallBody variant="secondary">Rating</SmallBody>
            </Flex>
            <Button size="lg" variant="secondary" href={href}>
              {listing.priceLabel}
            </Button>
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

function getListingHref(listingId: string) {
  return `/products/${listingId}`;
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

function getAppTagIcon(tag: string): LucideIcon {
  if (tag === "analytics") return BarChart3;
  if (tag === "developer tool") return Code2;
  if (tag === "social" || tag === "community" || tag === "moderation") {
    return RadioTower;
  }
  if (tag === "automation" || tag === "creator tool" || tag === "design") {
    return Sparkles;
  }
  if (tag === "account tool") return Bookmark;

  return AppWindow;
}

function getAppTagAccent(tag: string): DirectoryListingCard["accent"] {
  if (tag === "analytics" || tag === "social") return "blue";
  if (tag === "community" || tag === "moderation") return "purple";
  if (tag === "automation" || tag === "developer tool" || tag === "utility") {
    return "green";
  }

  return "pink";
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

function getSoftAccentSurface(accent: DirectoryListingCard["accent"]) {
  if (accent === "pink") return styles.softPinkSurface;
  if (accent === "purple") return styles.softPurpleSurface;
  if (accent === "green") return styles.softGreenSurface;

  return styles.softBlueSurface;
}
