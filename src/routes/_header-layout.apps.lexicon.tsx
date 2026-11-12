import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  notFound,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { SearchX } from "lucide-react";

import {
  formatDataTypeEyebrow,
  getDataKeyNsid,
} from "../components/shelf/discovery/data-hub";
import { DataTypeHeader } from "../components/shelf/discovery/DataTypeHeader";
import { ListingCardGrid } from "../components/shelf/discovery/ListingCardGrid";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateImage,
  EmptyStateTitle,
} from "../design-system/empty-state";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatOAuthLexiconKeyClusterStyleHeadline,
  formatOAuthLexiconKeyHeadline,
  oauthLexiconKeyKindLabel,
  parseOAuthLexiconKey,
} from "../lib/oauth-scope-lexicon-keys";
import { buildRouteOgMeta } from "../lib/og-meta";

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
      : parsed?.kind === "repo"
        ? `${data.count === 1 ? "1 app reads or writes" : `${String(data.count)} apps read or write`} ${headline} records, so data you create in one of them is available to the others.`
        : `These verified apps include ${headline} in their published OAuth scope vocabulary, so they may interoperate with the same AT Protocol permissions layer.`;

  return (
    <>
      <DataTypeHeader
        eyebrow={formatDataTypeEyebrow(kindLabel, [key])}
        title={
          parsed?.kind === "repo"
            ? formatOAuthLexiconKeyHeadline(key)
            : headline
        }
        description={heroDescription}
        sort={search.sort}
        sortLabel="Sort apps in lexicon collection"
        onSortChange={(sortKey) => {
          void router.navigate({
            to: "/apps/lexicon",
            search: { key, sort: sortKey },
          });
        }}
        keys={[
          {
            key,
            nsid: getDataKeyNsid(key),
            name: headline,
            linked: false,
          },
        ]}
      />

      {data.listings.length > 0 ? (
        <ListingCardGrid listings={data.listings} />
      ) : (
        <EmptyState size="lg">
          <EmptyStateImage>
            <SearchX size={48} strokeWidth={1.75} />
          </EmptyStateImage>
          <EmptyStateTitle>No apps use this data yet</EmptyStateTitle>
          <EmptyStateDescription>
            None of the listed apps read or write this kind of data right now.
            Check back later, or browse other shared data types.
          </EmptyStateDescription>
        </EmptyState>
      )}
    </>
  );
}
