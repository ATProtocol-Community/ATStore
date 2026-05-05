import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  notFound,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { StarRating } from "#/design-system/star-rating";
import { ChevronLeft } from "lucide-react";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

import { AppTagHero } from "../components/AppTagHero";
import { FeaturedListingFallbackCard } from "../components/FeaturedListingFallbackCard";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { HeroImage } from "../components/HeroImage";
import { Avatar } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
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
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import {
  formatLexiconClusterPageTitle,
  formatOAuthLexiconKeyClusterStyleHeadline,
  tryParseLexiconClusterSearchParam,
} from "../lib/oauth-scope-lexicon-keys";
import { buildRouteOgMeta } from "../lib/og-meta";

const sortOptions = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "alphabetical", label: "Alphabetical" },
] as const;

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
  emptyState: {
    gap: gap["lg"],
    maxWidth: "40rem",
  },
  badgeRow: {
    gap: gap.md,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    rowGap: gap.md,
    maxWidth: "48rem",
  },
  badgeLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    maxWidth: "100%",
  },
  badgeLabel: {
    overflow: "hidden",
    display: "block",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: {
      default: "18rem",
      [breakpoints.sm]: "22rem",
    },
    minWidth: 0,
  },
});

export const Route = createFileRoute("/_header-layout/apps/lexicon-set")({
  validateSearch: (
    search,
  ): { c: string; sort: "popular" | "newest" | "alphabetical" } => ({
    c: typeof search.c === "string" ? search.c : "",
    sort:
      search.sort === "newest"
        ? "newest"
        : search.sort === "alphabetical"
          ? "alphabetical"
          : "popular",
  }),
  loaderDeps: ({ search }) => ({
    c: search.c.trim(),
    sort: search.sort,
  }),
  loader: async ({ context, deps }) => {
    const clusterKeys = tryParseLexiconClusterSearchParam(deps.c);
    if (clusterKeys == null) {
      throw redirect({ to: "/apps/lexicons" });
    }

    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getAppsByLexiconClusterPageQueryOptions({
        keys: clusterKeys,
        sort: deps.sort,
      }),
    );

    if (data == null) {
      throw notFound();
    }

    const keyLabels = data.keys.map((k) =>
      formatOAuthLexiconKeyClusterStyleHeadline(k),
    );
    const titleSuffix = formatLexiconClusterPageTitle(data.keys);

    return {
      clusterKeys: data.keys,
      ogTitle: `${titleSuffix} · shared OAuth lexicons | at-store`,
      ogDescription: `Verified apps that advertise all of these repo record lexicons in OAuth scopes (${String(data.count)} listing${data.count === 1 ? "" : "s"}): ${keyLabels.join(", ")}.`,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "OAuth lexicon cluster | at-store",
      description:
        loaderData?.ogDescription ??
        "Explore apps grouped by overlapping OAuth lexicon identifiers.",
    }),
  component: AppsLexiconSetPage,
});

function AppsLexiconSetPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { clusterKeys } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getAppsByLexiconClusterPageQueryOptions({
      keys: clusterKeys,
      sort: search.sort,
    }),
  );

  if (data == null) {
    throw notFound();
  }

  const gridKey = data.keys.join("\u001F");

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" style={styles.navLinks}>
            <LinkLink to="/apps/lexicons">
              <ChevronLeft />
              All lexicon collections
            </LinkLink>
          </Flex>

          <AppTagHero
            eyebrow="Compatible data"
            title={formatLexiconClusterPageTitle(data.keys)}
            description="These apps use the same data sources, so they can interoperate with each other."
            action={
              <Select
                aria-label="Sort apps in lexicon cluster"
                items={sortOptions}
                placeholder="Sort apps"
                size="lg"
                style={styles.sortSelect}
                value={search.sort}
                variant="secondary"
                onChange={(sortKey) => {
                  if (
                    sortKey !== "popular" &&
                    sortKey !== "newest" &&
                    sortKey !== "alphabetical"
                  ) {
                    return;
                  }

                  void router.navigate({
                    to: "/apps/lexicon-set",
                    search: { c: search.c, sort: sortKey },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            }
          />
          {data.keys.length > 1 ? (
            <Flex style={styles.badgeRow}>
              {data.keys.map((k) => {
                const label = formatOAuthLexiconKeyClusterStyleHeadline(k);
                return (
                  <RouterLink
                    key={k}
                    to="/apps/lexicon"
                    search={{ key: k, sort: "popular" }}
                    title={label}
                    aria-label={`Browse apps for ${label}`}
                    {...stylex.props(styles.badgeLink)}
                  >
                    <Badge size="sm" variant="default">
                      <span {...stylex.props(styles.badgeLabel)}>{label}</span>
                    </Badge>
                  </RouterLink>
                );
              })}
            </Flex>
          ) : null}
        </Flex>

        {data.listings.length > 0 ? (
          <FeaturedListingGrid
            items={data.listings}
            getKey={(listing) => `${gridKey}-${listing.id}`}
            canFeature={(listing) => Boolean(listing.heroImageUrl)}
            renderItem={(listing, { featured }) => (
              <LexiconListingCard featured={featured} listing={listing} />
            )}
          />
        ) : (
          <Flex direction="column" style={styles.emptyState}>
            <Body variant="secondary">
              No verified app listings reference this exact cluster yet. Try the
              hub or a single-key browse page—or wait for the next OAuth probe
              sync.
            </Body>
          </Flex>
        )}
      </Flex>
    </Page.Root>
  );
}

function LexiconListingCard({
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
