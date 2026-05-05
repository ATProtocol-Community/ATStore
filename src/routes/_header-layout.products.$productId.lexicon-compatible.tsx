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
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import {
  formatOAuthLexiconKeyClusterStyleHeadline,
  oauthLexiconKeyKindLabel,
  parseOAuthLexiconKey,
} from "../lib/oauth-scope-lexicon-keys";
import { buildRouteOgMeta } from "../lib/og-meta";

const LEXICON_COMPATIBLE_PAGE_CAP = 250;

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
  lexiconBadgeGrow: {
    alignItems: "center",
    height: "auto",
    minHeight: size.lg,
    paddingBottom: verticalSpace.xs,
    paddingTop: verticalSpace.xs,
  },
  badgeRow: {
    gap: gap.md,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    rowGap: gap.md,
  },
  badgeLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
    maxWidth: "100%",
  },
  badgeInner: {
    gap: gap.sm,
    alignItems: "center",
    display: "flex",
    maxWidth: {
      default: "24rem",
      [breakpoints.sm]: "36rem",
    },
    minWidth: 0,
  },
  badgeLabel: {
    display: "block",
    flexShrink: 1,
    whiteSpace: "normal",
    wordBreak: "break-word",
    minWidth: 0,
  },
  badgeCount: {
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  },
});

export const Route = createFileRoute(
  "/_header-layout/products/$productId/lexicon-compatible",
)({
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
  loaderDeps: ({ search }) => ({ sort: search.sort }),
  loader: async ({ context, params, deps }) => {
    const legacyListingId = getLegacyDirectoryListingId(params.productId);
    const listing = await context.queryClient.ensureQueryData(
      legacyListingId
        ? directoryListingApi.getDirectoryListingDetailQueryOptions(
            legacyListingId,
          )
        : directoryListingApi.getDirectoryListingDetailBySlugQueryOptions(
            params.productId,
          ),
    );

    if (!listing) {
      throw notFound();
    }

    const productSlug = getDirectoryListingSlug(listing);

    if (params.productId !== productSlug) {
      throw redirect({
        to: "/products/$productId/lexicon-compatible",
        params: { productId: productSlug },
        search: { sort: deps.sort },
        replace: true,
      });
    }

    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getLexiconCompatibleAppsPageQueryOptions({
        listingId: listing.id,
        sort: deps.sort,
      }),
    );

    if (data == null) {
      throw redirect({
        to: "/products/$productId",
        params: { productId: productSlug },
      });
    }

    return {
      productId: listing.id,
      productSlug,
      listingName: listing.name,
      ogTitle: `Lexicon-compatible apps · ${listing.name} | at-store`,
      ogDescription: `${String(data.count)} verified app${data.count === 1 ? "" : "s"} overlap OAuth scope vocabulary with ${listing.name} (up to ${String(LEXICON_COMPATIBLE_PAGE_CAP)} in the grid). Badges list ${String(data.matchLexiconEntries.length)} repo record collection${data.matchLexiconEntries.length === 1 ? "" : "s"} with other-app counts.`,
      ogImage: listing.heroImageUrl || null,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Lexicon-compatible apps | at-store",
      description:
        loaderData?.ogDescription ??
        "Browse apps that overlap with this product OAuth scope vocabulary.",
      image: loaderData?.ogImage,
    }),
  component: LexiconCompatibleAppsPage,
});

function LexiconCompatibleAppsPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { productId, productSlug, listingName } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getLexiconCompatibleAppsPageQueryOptions({
      listingId: productId,
      sort: search.sort,
    }),
  );

  if (data == null) {
    throw redirect({
      to: "/products/$productId",
      params: { productId: productSlug },
    });
  }

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex direction="column" gap="4xl">
          <Flex gap="xl" style={styles.navLinks}>
            <LinkLink
              to="/products/$productId"
              params={{ productId: productSlug }}
            >
              <ChevronLeft />
              {listingName}
            </LinkLink>
          </Flex>

          <AppTagHero
            eyebrow="Shared data"
            title={`Apps compatible with ${listingName}`}
            description={
              <Flex direction="column" gap="2xl">
                <Body variant="secondary">
                  These apps use the same data sources and permissions, so they
                  can interoperate with each other.
                </Body>
                {data.matchLexiconEntries.length > 0 ? (
                  <Flex style={styles.badgeRow}>
                    {data.matchLexiconEntries.map(({ key, otherAppCount }) => (
                      <LexiconMatchBadge
                        key={key}
                        lexiconKey={key}
                        otherAppCount={otherAppCount}
                      />
                    ))}
                  </Flex>
                ) : null}
              </Flex>
            }
            action={
              <Select
                aria-label="Sort lexicon-compatible apps"
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
                    to: "/products/$productId/lexicon-compatible",
                    params: { productId: productSlug },
                    search: { sort: sortKey },
                  });
                }}
              >
                {(item) => <SelectItem>{item.label}</SelectItem>}
              </Select>
            }
          />
        </Flex>

        {data.listings.length > 0 ? (
          <FeaturedListingGrid
            items={data.listings}
            getKey={(listing) => listing.id}
            canFeature={(listing) => Boolean(listing.heroImageUrl)}
            renderItem={(listing, { featured }) => (
              <CompatibleAppListingCard featured={featured} listing={listing} />
            )}
          />
        ) : (
          <Flex direction="column" style={styles.emptyState}>
            <Body variant="secondary">
              No other verified apps overlap these lexicon identifiers yet, or
              probes are still incomplete.
            </Body>
          </Flex>
        )}
      </Flex>
    </Page.Root>
  );
}

function LexiconMatchBadge({
  lexiconKey,
  otherAppCount,
}: {
  lexiconKey: string;
  otherAppCount: number;
}) {
  const parsed = parseOAuthLexiconKey(lexiconKey);
  const kindLabel = parsed ? oauthLexiconKeyKindLabel(parsed.kind) : "Lexicon";
  const headline = formatOAuthLexiconKeyClusterStyleHeadline(lexiconKey);
  const title = `${headline} — ${String(otherAppCount)} other app${otherAppCount === 1 ? "" : "s"} (${kindLabel}: ${lexiconKey})`;

  return (
    <RouterLink
      to="/apps/lexicon"
      search={{ key: lexiconKey, sort: "popular" }}
      title={title}
      aria-label={title}
      {...stylex.props(styles.badgeLink)}
    >
      <Badge size="sm" variant="default" style={styles.lexiconBadgeGrow}>
        <span {...stylex.props(styles.badgeInner)}>
          <span {...stylex.props(styles.badgeLabel)}>{headline}</span>
          <span {...stylex.props(styles.badgeCount)}>{otherAppCount}</span>
        </span>
      </Badge>
    </RouterLink>
  );
}

function CompatibleAppListingCard({
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
