import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { DirectoryGameCard } from "../integrations/tanstack-query/api-directory-listings.functions";
import type { GameStatus } from "../lib/atproto/game-define-record";

import { GameFeature, GameTile } from "../components/shelf/discovery/Games";
import { PageHero } from "../components/shelf/Section";
import { Button } from "../design-system/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateImage,
  EmptyStateTitle,
} from "../design-system/empty-state";
import { SearchField } from "../design-system/search-field";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../design-system/segmented-control";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  ATMOSPHERE_GAMES_URL,
  GAMES_APP_TAG_SLUG,
  GAME_STATUS_LABELS,
  GAME_STATUS_ORDER,
  getGameStatus,
} from "../lib/game-listing";
import { buildAppTagOgImageUrl, buildRouteOgMeta } from "../lib/og-meta";

const QUERY_DEBOUNCE_MS = 250;

const GAME_SORTS = ["popular", "new", "az"] as const;
type GameSort = (typeof GAME_SORTS)[number];

const sortOptions: Array<{ id: GameSort; label: string }> = [
  { id: "popular", label: "Popular" },
  { id: "new", label: "Newest" },
  { id: "az", label: "A–Z" },
];

const gameStatusSchema = z.enum(GAME_STATUS_ORDER);
const gameSortSchema = z.enum(GAME_SORTS);

/** `/games` URL state: `?status=live&q=chess&sort=new`. Bad values fall back to the defaults. */
interface GamesSearch {
  status?: GameStatus;
  q?: string;
  sort?: GameSort;
}

function validateGamesSearch(raw: Record<string, unknown>): GamesSearch {
  const q = typeof raw.q === "number" ? String(raw.q) : raw.q;
  return {
    status: gameStatusSchema.safeParse(raw.status).data,
    q: typeof q === "string" && q.trim() ? q : undefined,
    sort: gameSortSchema.safeParse(raw.sort).data,
  };
}

const OG_DESCRIPTION =
  "Games built on the AT Protocol, listed from atmosphere.games. Filter by status and find something to play.";

export const Route = createFileRoute("/_header-layout/games/")({
  validateSearch: validateGamesSearch,
  loader: async ({ context }) => {
    const games = await context.queryClient.ensureQueryData(
      directoryListingApi.getGamesDirectoryQueryOptions,
    );
    return {
      ogImage: buildAppTagOgImageUrl({
        tag: GAMES_APP_TAG_SLUG,
        label: "Games",
        kind: "Games",
        count: games.length,
      }),
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: "Games | at-store",
      description: OG_DESCRIPTION,
      image: loaderData?.ogImage,
    }),
  component: GamesPage,
});

const styles = stylex.create({
  credit: {
    textDecoration: "underline",
    color: "inherit",
    textDecorationColor: { default: uiColor.border2, ":hover": uiColor.text1 },
    textUnderlineOffset: 3,
  },
  toolbar: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexWrap: { default: "wrap", [breakpoints.md]: "nowrap" },
    rowGap: 10,
    marginTop: 40,
  },
  toolbarFirst: {
    marginTop: 0,
  },
  searchField: {
    flexBasis: { default: "100%", [breakpoints.md]: "auto" },
    flexGrow: 1,
  },
  filters: {
    maxWidth: "100%",
    overflowX: "auto",
  },
  statusRow: {
    marginTop: 10,
  },
  count: {
    color: uiColor.text1,
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    marginBottom: 12,
    marginTop: 20,
  },
  grid: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    columnGap: { default: 12, [breakpoints.md]: 16 },
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [breakpoints.lg]: "repeat(3, minmax(0, 1fr))",
      [breakpoints.xl]: "repeat(4, minmax(0, 1fr))",
    },
    rowGap: { default: 24, [breakpoints.md]: 32 },
  },
});

function matchesQuery(game: DirectoryGameCard, query: string) {
  if (!query) return true;
  return [
    game.name,
    game.tagline,
    game.developerName ?? "",
    ...game.gameTags,
  ].some((text) => text.toLowerCase().includes(query));
}

function sortGames(games: Array<DirectoryGameCard>, sort: GameSort) {
  switch (sort) {
    case "popular": {
      return games;
    }
    case "new": {
      return games.toSorted(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    }
    case "az": {
      return games.toSorted((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    }
  }
}

function GamesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: games } = useSuspenseQuery(
    directoryListingApi.getGamesDirectoryQueryOptions,
  );

  const sort: GameSort = search.sort ?? "popular";
  const query = search.q?.trim().toLowerCase() ?? "";

  const statusCounts = useMemo(() => {
    const counts = new Map<GameStatus, number>();
    for (const game of games) {
      const status = getGameStatus(game.gameStatus);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return counts;
  }, [games]);

  const results = useMemo(
    () =>
      sortGames(
        games.filter(
          (game) =>
            (!search.status ||
              getGameStatus(game.gameStatus) === search.status) &&
            matchesQuery(game, query),
        ),
        sort,
      ),
    [games, search.status, query, sort],
  );

  // Only offer statuses that have games (plus the selected one, so it stays visible).
  const statusFilters = GAME_STATUS_ORDER.filter(
    (status) => (statusCounts.get(status) ?? 0) > 0 || status === search.status,
  );

  const updateSearch = (next: Partial<GamesSearch>) => {
    void navigate({
      search: (prev) => ({ ...prev, ...next }),
      resetScroll: false,
    });
  };

  // Lead with the most popular game that has cover art, but only on the unfiltered default view.
  const featured =
    sort === "popular" && !query && !search.status
      ? results.find((game) => game.heroImageUrl)
      : undefined;

  return (
    <>
      <PageHero
        eyebrow="Games"
        title="Games on the Atmosphere"
        description={
          <>
            Games built on the AT Protocol: play with your Atmosphere account
            and keep your progress in your own repo. Listed from{" "}
            <a
              href={ATMOSPHERE_GAMES_URL}
              target="_blank"
              rel="noopener noreferrer"
              {...stylex.props(styles.credit)}
            >
              atmosphere.games
            </a>
            , the AT Protocol games directory.
          </>
        }
      />

      {featured ? <GameFeature game={featured} /> : null}

      <div {...stylex.props(styles.toolbar, !featured && styles.toolbarFirst)}>
        <div {...stylex.props(styles.searchField)}>
          <GamesQueryField query={search.q ?? ""} />
        </div>
        <SegmentedControl
          aria-label="Sort games"
          selectedKeys={[sort]}
          style={styles.filters}
          onSelectionChange={(keys) => {
            const [key] = keys;
            const next = GAME_SORTS.find((id) => id === key);
            if (!next) return;
            updateSearch({ sort: next === "popular" ? undefined : next });
          }}
        >
          {sortOptions.map((option) => (
            <SegmentedControlItem key={option.id} id={option.id}>
              {option.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>

      {statusFilters.length > 1 ? (
        <div {...stylex.props(styles.statusRow)}>
          <SegmentedControl
            aria-label="Filter by status"
            selectedKeys={[search.status ?? "all"]}
            style={styles.filters}
            onSelectionChange={(keys) => {
              const [key] = keys;
              const next = GAME_STATUS_ORDER.find((id) => id === key);
              updateSearch({ status: next });
            }}
          >
            <SegmentedControlItem id="all">
              {`All (${games.length})`}
            </SegmentedControlItem>
            {statusFilters.map((status) => (
              <SegmentedControlItem key={status} id={status}>
                {`${GAME_STATUS_LABELS[status]} (${statusCounts.get(status) ?? 0})`}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
      ) : null}

      <div {...stylex.props(styles.count)}>
        {results.length === games.length
          ? `${games.length} ${games.length === 1 ? "game" : "games"}`
          : `${results.length} of ${games.length} games`}
      </div>

      {results.length > 0 ? (
        <ul role="list" {...stylex.props(styles.grid)}>
          {results.map((game) => (
            <li key={game.id}>
              <GameTile game={game} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState size="lg">
          <EmptyStateImage>
            <SearchX size={48} strokeWidth={1.75} />
          </EmptyStateImage>
          <EmptyStateTitle>
            {games.length === 0
              ? "No games listed yet"
              : "No games match these filters"}
          </EmptyStateTitle>
          <EmptyStateDescription>
            {games.length === 0
              ? "Games published on atmosphere.games will show up here."
              : "Try another status or search for something broader."}
          </EmptyStateDescription>
          {games.length > 0 ? (
            <EmptyStateActions>
              <Button
                variant="secondary"
                onPress={() =>
                  void navigate({ search: {}, resetScroll: false })
                }
              >
                Clear search and filters
              </Button>
            </EmptyStateActions>
          ) : null}
        </EmptyState>
      )}
    </>
  );
}

/** Text search kept in the URL (`?q=`), debounced so typing doesn't spam history. */
function GamesQueryField({ query }: { query: string }) {
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const next = draft.trim();
    if (next === query) return;
    const timeout = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: next || undefined }),
        replace: true,
        resetScroll: false,
      });
    }, QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [draft, query, navigate]);

  return (
    <SearchField
      aria-label="Search games"
      placeholder="Search games, developers, tags…"
      value={draft}
      onChange={setDraft}
      size="lg"
      variant="secondary"
    />
  );
}
