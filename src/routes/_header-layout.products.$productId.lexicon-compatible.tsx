import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from "@tanstack/react-router";

import { ListingCard } from "../components/shelf/ListingCard";
import { BackLink, PageHero } from "../components/shelf/Section";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../design-system/segmented-control";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";
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
  { id: "alphabetical", label: "A–Z" },
] as const;

const styles = stylex.create({
  page: {
    paddingBottom: { default: 56, [breakpoints.md]: 88 },
  },
  keyRow: {
    columnGap: 8,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 8,
  },
  keyPill: {
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: 12,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: uiColor.bg,
    color: uiColor.text2,
    columnGap: 8,
    display: "inline-flex",
    fontSize: 13,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    height: 32,
    maxWidth: "100%",
  },
  keyLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  keyCount: {
    color: uiColor.text1,
    fontVariantNumeric: "tabular-nums",
  },
  cards: {
    gap: { default: 12, [breakpoints.md]: 16 },
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(4, minmax(0, 1fr))",
    },
    marginTop: 32,
  },
  empty: {
    borderColor: uiColor.border2,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingBlock: 56,
    paddingInline: 24,
    color: uiColor.text1,
    textAlign: "center",
    marginTop: 32,
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
    <div {...stylex.props(styles.page)}>
      <PageHero
        back={
          <BackLink
            to="/products/$productId"
            params={{ productId: productSlug }}
          >
            Back to {listingName}
          </BackLink>
        }
        eyebrow="Shared data"
        title={`Apps compatible with ${listingName}`}
        description="These apps use the same data, so what you make in one shows up in the others."
        aside={
          <SegmentedControl
            aria-label="Sort lexicon-compatible apps"
            size="md"
            selectedKeys={[search.sort]}
            onSelectionChange={(keys) => {
              const [sortKey] = keys;
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
            {sortOptions.map((option) => (
              <SegmentedControlItem key={option.id} id={option.id}>
                {option.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        }
      />

      {data.matchLexiconEntries.length > 0 ? (
        <div {...stylex.props(styles.keyRow)}>
          {data.matchLexiconEntries.map(({ key, otherAppCount }) => (
            <LexiconMatchPill
              key={key}
              lexiconKey={key}
              otherAppCount={otherAppCount}
            />
          ))}
        </div>
      ) : null}

      {data.listings.length > 0 ? (
        <div {...stylex.props(styles.cards)}>
          {data.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <p {...stylex.props(styles.empty)}>
          No other verified apps overlap these lexicon identifiers yet, or
          probes are still incomplete.
        </p>
      )}
    </div>
  );
}

function LexiconMatchPill({
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
      {...stylex.props(styles.keyPill)}
    >
      <span {...stylex.props(styles.keyLabel)}>{headline}</span>
      <span {...stylex.props(styles.keyCount)}>{otherAppCount}</span>
    </RouterLink>
  );
}
