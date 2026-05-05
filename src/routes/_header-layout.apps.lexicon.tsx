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
  formatOAuthLexiconKeyClusterStyleHeadline,
  oauthLexiconKeyKindLabel,
  parseOAuthLexiconKey,
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
});

export const Route = createFileRoute("/_header-layout/apps/lexicon")({
  validateSearch: (
    search,
  ): { key: string; sort: "popular" | "newest" | "alphabetical" } => ({
    key: typeof search.key === "string" ? search.key : "",
    sort:
      search.sort === "newest"
        ? "newest"
        : search.sort === "alphabetical"
          ? "alphabetical"
          : "popular",
  }),
  loaderDeps: ({ search }) => ({
    key: search.key,
    sort: search.sort,
  }),
  loader: async ({ context, deps }) => {
    const key = deps.key.trim();
    if (!key) {
      throw redirect({ to: "/apps/lexicons" });
    }
    if (!parseOAuthLexiconKey(key)) {
      throw notFound();
    }
    const data = await context.queryClient.ensureQueryData(
      directoryListingApi.getAppsByLexiconPageQueryOptions({
        key,
        sort: deps.sort,
      }),
    );
    const parsed = parseOAuthLexiconKey(key);
    const headline = formatOAuthLexiconKeyClusterStyleHeadline(key);
    const kind = parsed ? oauthLexiconKeyKindLabel(parsed.kind) : "Lexicon";
    const nsid = parsed?.nsid?.trim() ?? "";
    const lexiconRecordDescription =
      nsid.length > 0
        ? await context.queryClient.ensureQueryData(
            directoryListingApi.getLexiconRecordMainDescriptionForNsidQueryOptions(
              nsid,
            ),
          )
        : null;
    const baseOg = `Verified apps that advertise overlapping OAuth scope vocabulary for ${headline} (${kind.toLowerCase()}). ${String(data.count)} listing${data.count === 1 ? "" : "s"}.`;
    const ogDescription = lexiconRecordDescription?.trim()
      ? `${lexiconRecordDescription.trim()} ${baseOg}`
      : baseOg;
    return {
      key,
      lexiconRecordDescription,
      ogTitle: `${headline} · ${kind} | at-store`,
      ogDescription,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Lexicon | at-store",
      description:
        loaderData?.ogDescription ||
        "Explore apps grouped by overlapping data type identifiers.",
    }),
  component: AppsLexiconPage,
});

function AppsLexiconPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { key, lexiconRecordDescription } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getAppsByLexiconPageQueryOptions({
      key,
      sort: search.sort,
    }),
  );

  const parsed = parseOAuthLexiconKey(key);
  const kindLabel = parsed ? oauthLexiconKeyKindLabel(parsed.kind) : "Lexicon";
  const headline = formatOAuthLexiconKeyClusterStyleHeadline(key);
  const heroDescription =
    lexiconRecordDescription != null && lexiconRecordDescription.trim() !== ""
      ? lexiconRecordDescription.trim()
      : `These verified apps include ${headline} in their published OAuth scope vocabulary, so they may interoperate with the same AT Protocol permissions layer.`;

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
            eyebrow={kindLabel}
            title={headline}
            description={heroDescription}
            action={
              <Select
                aria-label="Sort apps in lexicon collection"
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
                    to: "/apps/lexicon",
                    search: { key, sort: sortKey },
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
            getKey={(listing) => `${key}-${listing.id}`}
            canFeature={(listing) => Boolean(listing.heroImageUrl)}
            renderItem={(listing, { featured }) => (
              <LexiconListingCard featured={featured} listing={listing} />
            )}
          />
        ) : (
          <Flex direction="column" style={styles.emptyState}>
            <Body variant="secondary">
              No verified app listings reference this lexicon key yet. Lexicon
              keys are populated from storefront OAuth probes — try again after
              the next sync, or pick another collection from the hub.
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
