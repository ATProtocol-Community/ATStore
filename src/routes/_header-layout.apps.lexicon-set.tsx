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
  formatDataTypeTitle,
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
  formatLexiconClusterPageTitle,
  formatOAuthLexiconKeyClusterStyleHeadline,
  parseOAuthLexiconKey,
  tryParseLexiconClusterSearchParam,
} from "../lib/oauth-scope-lexicon-keys";
import { buildRouteOgMeta } from "../lib/og-meta";

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

    let lexiconRecordDescription: string | null = null;
    if (data.keys.length === 1) {
      const onlyKey = data.keys[0];
      const parsed = onlyKey ? parseOAuthLexiconKey(onlyKey) : null;
      const nsid = parsed?.nsid?.trim() ?? "";
      if (nsid.length > 0) {
        lexiconRecordDescription = await context.queryClient.ensureQueryData(
          directoryListingApi.getLexiconRecordMainDescriptionForNsidQueryOptions(
            nsid,
          ),
        );
      }
    }

    const baseOg = `Verified apps that advertise all of these repo record lexicons in OAuth scopes (${String(data.count)} listing${data.count === 1 ? "" : "s"}): ${keyLabels.join(", ")}.`;
    const ogDescription = lexiconRecordDescription?.trim()
      ? `${lexiconRecordDescription.trim()} ${baseOg}`
      : baseOg;

    return {
      clusterKeys: data.keys,
      lexiconRecordDescription,
      ogTitle: `${titleSuffix} · shared data | at-store`,
      ogDescription,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Shared data | at-store",
      description:
        loaderData?.ogDescription ??
        "Explore apps grouped by overlapping data type identifiers.",
    }),
  component: AppsLexiconSetPage,
});

function AppsLexiconSetPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { clusterKeys, lexiconRecordDescription } = Route.useLoaderData();
  const { data } = useSuspenseQuery(
    directoryListingApi.getAppsByLexiconClusterPageQueryOptions({
      keys: clusterKeys,
      sort: search.sort,
    }),
  );

  if (data == null) {
    throw notFound();
  }

  const defaultHeroDescription =
    "These apps use the same data sources, so they can interoperate with each other.";
  const heroDescription =
    data.keys.length === 1 &&
    lexiconRecordDescription != null &&
    lexiconRecordDescription.trim() !== ""
      ? lexiconRecordDescription.trim()
      : defaultHeroDescription;

  return (
    <>
      <DataTypeHeader
        eyebrow={formatDataTypeEyebrow("Compatible data", data.keys)}
        title={formatDataTypeTitle(data.keys, 4)}
        description={heroDescription}
        sort={search.sort}
        sortLabel="Sort apps in lexicon cluster"
        onSortChange={(sortKey) => {
          void router.navigate({
            to: "/apps/lexicon-set",
            search: { c: search.c, sort: sortKey },
          });
        }}
        keys={data.keys.map((key) => ({
          key,
          nsid: getDataKeyNsid(key),
          name: formatOAuthLexiconKeyClusterStyleHeadline(key),
          linked: data.keys.length > 1,
        }))}
      />

      {data.listings.length > 0 ? (
        <ListingCardGrid listings={data.listings} />
      ) : (
        <EmptyState size="lg">
          <EmptyStateImage>
            <SearchX size={48} strokeWidth={1.75} />
          </EmptyStateImage>
          <EmptyStateTitle>No apps share this data yet</EmptyStateTitle>
          <EmptyStateDescription>
            No listed apps use this exact combination of data right now. Try one
            of the data types above on its own, or browse all shared data.
          </EmptyStateDescription>
        </EmptyState>
      )}
    </>
  );
}
