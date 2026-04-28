import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { AppTagCard } from "../components/AppTagCard";
import { AppTagHero } from "../components/AppTagHero";
import { FeaturedListingFallbackCard } from "../components/FeaturedListingFallbackCard";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { HeroImage } from "../components/HeroImage";
import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Grid } from "../design-system/grid";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { Select, SelectItem } from "../design-system/select";
import { blue } from "../design-system/theme/colors/blue.stylex";
import { indigo as green } from "../design-system/theme/colors/indigo.stylex";
import { pink } from "../design-system/theme/colors/pink.stylex";
import { purple } from "../design-system/theme/colors/purple.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
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
} from "../lib/app-tag-metadata";
import { getAppTagHeroAssetPathForTag } from "../lib/app-tag-hero-art";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { buildRouteOgMeta } from "../lib/og-meta";
import { StarRating } from "#/design-system/star-rating";

const sortOptions = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
] as const;

export const Route = createFileRoute("/_header-layout/apps/$tag")({
  validateSearch: (
    search,
  ): { sort: "popular" | "newest" | "alphabetical" } => ({
    sort:
      search.sort === "newest"
        ? "newest"
        : search.sort === "alphabetical"
          ? "alphabetical"
          : "popular",
  }),
  loaderDeps: ({ search }) => ({
    sort: search.sort,
  }),
  loader: async ({ context, params, deps }) => {
    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getAppsByTagPageQueryOptions({
        tag: params.tag,
        sort: deps.sort,
      }),
    );

    if (!data) {
      throw notFound();
    }

    return {
      tag: params.tag,
      ogTitle: `${formatAppTagLabel(data.tag)} apps | at-store`,
      ogDescription: getAppTagDescription(data.tag),
      ogImage: getAppTagHeroAssetPathForTag(data.tag),
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "App tag | at-store",
      description:
        loaderData?.ogDescription ||
        "Explore listings grouped under this app workflow tag.",
      image: loaderData?.ogImage,
    }),
  component: AppsTagPage,
});

const LinkLink = createLink(Link);

const styles = stylex.create({
  pageContent: {
    gap: {
      default: gap["6xl"],
      [breakpoints.xl]: gap["7xl"],
    },
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
  resultsHeader: {
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  resultsActions: {
    alignItems: "center",
    flexWrap: "wrap",
  },
  resultCount: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  sortSelect: {
    minWidth: "12rem",
    flexGrow: {
      default: 1,
      [breakpoints.sm]: 0,
    },
  },
  listingLink: {
    display: "block",
    height: "100%",
    textDecoration: "none",
    position: "relative",
    zIndex: 1,
  },
  listingLinkFeatured: {
    zIndex: 0,
  },
  listingCard: {
    height: "100%",
    width: "100%",
    boxSizing: "border-box",
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
  accentOverlay: {
    background: `linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 12%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 48%, transparent) 46%, color-mix(in srgb, ${uiColor.overlayBackdrop} 100%, transparent) 100%)`,
    inset: 0,
    position: "absolute",
  },
  heroOverlay: {
    background: `linear-gradient(90deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 88%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 78%, transparent) 34%, color-mix(in srgb, ${uiColor.overlayBackdrop} 38%, transparent) 68%, color-mix(in srgb, ${uiColor.overlayBackdrop} 16%, transparent) 100%), linear-gradient(180deg, color-mix(in srgb, ${uiColor.overlayBackdrop} 20%, transparent) 0%, color-mix(in srgb, ${uiColor.overlayBackdrop} 18%, transparent) 32%, color-mix(in srgb, ${uiColor.overlayBackdrop} 96%, transparent) 100%)`,
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
  relatedSection: {
    gap: gap["5xl"],
    paddingTop: verticalSpace["6xl"],
  },
  relatedHeader: {
    maxWidth: "44rem",
  },
  relatedDescription: {
    maxWidth: "40rem",
  },
  relatedGrid: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.md]: "repeat(4, minmax(0, 1fr))",
    },
  },
  relatedLink: {
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.lg,
    color: "white",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    justifyContent: "space-between",
    minHeight: "14rem",
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
    position: "relative",
    textDecoration: "none",
    gap: gap["3xl"],
  },
  relatedCardBody: {
    flexGrow: 1,
  },
  relatedCount: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  relatedIcon: {
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
  relatedChevron: {
    marginLeft: "auto",
  },
  spacer: {
    flex: 1,
  },
});

function AppsTagPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { tag } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getAppsByTagPageQueryOptions({
      tag,
      sort: search.sort,
    }),
  );
  const { data: allGroups } = useSuspenseQuery(
    directoryListingApi.getAppsByTagQueryOptions,
  );

  if (!data) {
    throw notFound();
  }

  const relatedTags = getRelatedAppTagGroups(data, allGroups);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" style={styles.navLinks}>
            <LinkLink to="/apps/tags">
              <ChevronLeft />
              All tags
            </LinkLink>
          </Flex>

          <AppTagHero
            eyebrow={formatAppTagCount(data.count)}
            title={formatAppTagLabel(data.tag)}
            description={getAppTagDescription(data.tag)}
            imageSrc={getAppTagHeroAssetPathForTag(data.tag)}
            action={
              <Select
                aria-label="Sort apps in tag"
                items={sortOptions}
                placeholder="Sort apps"
                size="lg"
                style={styles.sortSelect}
                value={search.sort}
                variant="secondary"
                onChange={(key) => {
                  if (
                    key !== "popular" &&
                    key !== "newest" &&
                    key !== "alphabetical"
                  ) {
                    return;
                  }

                  void router.navigate({
                    to: "/apps/$tag",
                    params: { tag },
                    search: { sort: key },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            }
          />
        </Flex>

        <FeaturedListingGrid
          items={data.listings}
          getKey={(listing) => `${data.tag}-${listing.id}`}
          canFeature={(listing) => Boolean(listing.heroImageUrl)}
          renderItem={(listing, { featured }) => (
            <AppTagListingCard featured={featured} listing={listing} />
          )}
        />

        {relatedTags.length > 0 ? (
          <RelatedTagsSection groups={relatedTags} />
        ) : null}
      </Flex>
    </Page.Root>
  );
}

function AppTagListingCard({
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
      {...stylex.props(
        styles.listingLink,
        featured && styles.listingLinkFeatured,
      )}
    >
      {featured ? (
        listing.heroImageUrl ? (
          <HeroImage
            alt={getDirectoryListingHeroImageAlt(listing)}
            glowIntensity={0.8}
            src={listing.heroImageUrl}
          />
        ) : (
          <FeaturedListingFallbackCard listing={listing} />
        )
      ) : (
        <Card style={[styles.listingCard]}>
          <Flex direction="column" style={[styles.listingCardBody]}>
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
                <SmallBody variant="secondary">
                  @
                  {listing.productAccountHandle?.replace(/^@/, "") || "unknown"}
                </SmallBody>
              </Flex>
            </Flex>
            <Body variant="secondary" style={styles.listingTagline}>
              {listing.tagline}
            </Body>
            <Flex align="center" justify="end" gap="lg">
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
        </Card>
      )}
    </RouterLink>
  );
}

function RelatedTagsSection({ groups }: { groups: DirectoryAppTagGroup[] }) {
  return (
    <Flex direction="column" style={styles.relatedSection}>
      <Flex direction="column" gap="4xl" style={styles.relatedHeader}>
        <Text size="3xl" weight="semibold">
          Related tags to explore
        </Text>
        <Body variant="secondary" style={styles.relatedDescription}>
          Explore adjacent workflows and neighboring collections that share apps
          with this tag.
        </Body>
      </Flex>
      <Grid style={styles.relatedGrid}>
        {groups.map((group) => (
          <AppTagCard key={group.tag} tag={group} />
        ))}
      </Grid>
    </Flex>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getRelatedAppTagGroups(
  currentGroup: DirectoryAppTagGroup,
  groups: DirectoryAppTagGroup[],
) {
  const currentListingIds = new Set(
    currentGroup.listings.map((listing) => listing.id),
  );

  return groups
    .filter((group) => group.tag !== currentGroup.tag)
    .sort((left, right) => {
      const leftOverlap = left.listings.reduce(
        (count, listing) => count + Number(currentListingIds.has(listing.id)),
        0,
      );
      const rightOverlap = right.listings.reduce(
        (count, listing) => count + Number(currentListingIds.has(listing.id)),
        0,
      );

      if (rightOverlap !== leftOverlap) {
        return rightOverlap - leftOverlap;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.tag.localeCompare(right.tag);
    })
    .slice(0, 4);
}
