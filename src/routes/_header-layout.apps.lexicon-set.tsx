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
import { ChevronLeft } from "lucide-react";

import { AppCard } from "../components/AppCard";
import { AppTagHero } from "../components/AppTagHero";
import { FeaturedListingGrid } from "../components/FeaturedListingGrid";
import { Badge } from "../design-system/badge";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { Select, SelectItem } from "../design-system/select";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  gap,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body } from "../design-system/typography";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatLexiconClusterPageTitle,
  formatOAuthLexiconKeyClusterStyleHeadline,
  parseOAuthLexiconKey,
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
  lexiconBadgeGrow: {
    alignItems: "center",
    height: "auto",
    minHeight: size.lg,
    paddingBottom: verticalSpace.xs,
    paddingTop: verticalSpace.xs,
  },
  badgeLabel: {
    display: "block",
    whiteSpace: "normal",
    wordBreak: "break-word",
    maxWidth: {
      default: "24rem",
      [breakpoints.sm]: "36rem",
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

  const gridKey = data.keys.join("\u001F");

  const defaultHeroDescription =
    "These apps use the same data sources, so they can interoperate with each other.";
  const heroDescription =
    data.keys.length === 1 &&
    lexiconRecordDescription != null &&
    lexiconRecordDescription.trim() !== ""
      ? lexiconRecordDescription.trim()
      : defaultHeroDescription;

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
            description={heroDescription}
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
                    <Badge
                      size="sm"
                      variant="default"
                      style={styles.lexiconBadgeGrow}
                    >
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
              <AppCard listing={listing} size={featured ? "large" : "small"} />
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
