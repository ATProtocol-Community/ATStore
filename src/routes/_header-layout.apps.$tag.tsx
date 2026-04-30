import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  notFound,
  useRouter,
} from "@tanstack/react-router";
import { StarRating } from "#/design-system/star-rating";
import { ChevronLeft } from "lucide-react";

import type {
  DirectoryAppTagGroup,
  DirectoryListingCard,
} from "../integrations/tanstack-query/api-directory-listings.functions";

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
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagCount,
  formatAppTagLabel,
  getAppTagDescription,
} from "../lib/app-tag-metadata";
import { getAppTagAccent, getAppTagEmoji } from "../lib/app-tag-visuals";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { buildAppTagOgImageUrl, buildRouteOgMeta } from "../lib/og-meta";

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
      ogImage: buildAppTagOgImageUrl({
        tag: data.tag,
        label: formatAppTagLabel(data.tag),
        kind: "App Tag",
        count: data.count,
      }),
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
  sortSelect: {
    flexGrow: {
      default: 1,
      [breakpoints.sm]: 0,
    },
    minWidth: "12rem",
  },
  listingLink: {
    textDecoration: "none",
    display: "block",
    position: "relative",
    zIndex: 1,
    height: "100%",
  },
  listingLinkFeatured: {
    zIndex: 0,
  },
  listingCard: {
    boxSizing: "border-box",
    height: "100%",
    width: "100%",
  },

  listingCardBody: {
    gap: gap["4xl"],
    position: "relative",
    height: "100%",
    paddingBottom: verticalSpace["xl"],
    paddingLeft: horizontalSpace["xl"],
    paddingRight: horizontalSpace["xl"],
    paddingTop: verticalSpace["xl"],
  },
  listingHeader: {
    gap: gap["2xl"],
    position: "relative",
    zIndex: 1,
  },
  listingInfo: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
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
    gap: gap["2xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      [breakpoints.sm]: "repeat(2, minmax(0, 1fr))",
      [breakpoints.md]: "repeat(4, minmax(0, 1fr))",
    },
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
            accent={getAppTagAccent(data.tag)}
            emojis={[getAppTagEmoji(data.tag)]}
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
                {listing.rating == null ? "—" : listing.rating.toFixed(1)}
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

function RelatedTagsSection({
  groups,
}: {
  groups: Array<DirectoryAppTagGroup>;
}) {
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

function getRelatedAppTagGroups(
  currentGroup: DirectoryAppTagGroup,
  groups: Array<DirectoryAppTagGroup>,
) {
  const currentListingIds = new Set(
    currentGroup.listings.map((listing) => listing.id),
  );

  return groups
    .filter((group) => group.tag !== currentGroup.tag)
    .toSorted((left, right) => {
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
