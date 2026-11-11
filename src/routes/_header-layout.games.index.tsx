import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { DirectoryGameCard } from "../integrations/tanstack-query/api-directory-listings.functions";
import type { GameStatus } from "../lib/atproto/game-define-record";

import { DetailedAppRow } from "../components/AppListRow";
import { AppTagHero } from "../components/AppTagHero";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateImage,
  EmptyStateTitle,
} from "../design-system/empty-state";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { SearchField } from "../design-system/search-field";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../design-system/segmented-control";
import { Select, SelectItem } from "../design-system/select";
import { uiColor } from "../design-system/theme/color.stylex";
import { verticalSpace } from "../design-system/theme/semantic-spacing.stylex";
import { SmallBody } from "../design-system/typography";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { getAppTagAccent, getAppTagEmoji } from "../lib/app-tag-visuals";
import {
  ATMOSPHERE_GAMES_URL,
  GAMES_APP_TAG_SLUG,
  GAME_STATUS_LABELS,
  GAME_STATUS_ORDER,
  getGameStatus,
  getGameStatusBadgeVariant,
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
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  toolbar: {
    flexWrap: "wrap",
  },
  searchField: {
    flexBasis: "16rem",
    flexGrow: 1,
  },
  sortSelect: {
    minWidth: "12rem",
  },
  statusFilter: {
    maxWidth: "100%",
    overflowX: "auto",
  },
  resultCount: {
    color: uiColor.text1,
  },
  // Rows carry the spacing between them (see DetailedAppRow); pull the list
  // out by that amount so the first and last rows line up with the toolbar.
  results: {
    padding: 0,
    listStyle: "none",
    marginBottom: `calc(${verticalSpace.sm} * -1)`,
    marginLeft: 0,
    marginRight: 0,
    marginTop: `calc(${verticalSpace.sm} * -1)`,
  },
  emptyState: {
    padding: verticalSpace["10xl"],
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

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="7xl">
        <Flex direction="column" gap="2xl">
          <AppTagHero
            eyebrow="Games"
            title="Games on the Atmosphere"
            description="Games built on the AT Protocol — play with your Atmosphere account and keep your progress in your own repo."
            accent={getAppTagAccent(GAMES_APP_TAG_SLUG)}
            emojis={[getAppTagEmoji(GAMES_APP_TAG_SLUG)]}
          />
          <SmallBody variant="secondary">
            Listed from{" "}
            <Link
              href={ATMOSPHERE_GAMES_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              atmosphere.games
            </Link>
            , the AT Protocol games directory.
          </SmallBody>
        </Flex>

        <Flex direction="column" gap="2xl">
          <Flex align="center" gap="xl" style={styles.toolbar}>
            <div {...stylex.props(styles.searchField)}>
              <GamesQueryField query={search.q ?? ""} />
            </div>
            <Select
              aria-label="Sort games"
              items={sortOptions}
              size="lg"
              style={styles.sortSelect}
              value={sort}
              variant="secondary"
              onChange={(key) => {
                const next = GAME_SORTS.find((id) => id === key);
                if (!next) return;
                updateSearch({ sort: next === "popular" ? undefined : next });
              }}
            >
              {(item) => <SelectItem>{item.label}</SelectItem>}
            </Select>
          </Flex>

          {statusFilters.length > 1 ? (
            <SegmentedControl
              aria-label="Filter by status"
              selectedKeys={[search.status ?? "all"]}
              style={styles.statusFilter}
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
          ) : null}

          <SmallBody style={styles.resultCount}>
            {results.length === games.length
              ? `${games.length} ${games.length === 1 ? "game" : "games"}`
              : `${results.length} of ${games.length} games`}
          </SmallBody>

          {results.length > 0 ? (
            <ul role="list" {...stylex.props(styles.results)}>
              {results.map((game) => (
                <li key={game.id}>
                  <GameRow game={game} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState size="lg" style={styles.emptyState}>
              <EmptyStateImage>
                <SearchX size={64} strokeWidth={2} />
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
        </Flex>
      </Flex>
    </Page.Root>
  );
}

/**
 * The shared browse row. Games are all tagged `games`, so the row shows the developer's own
 * genre tags instead, and a status badge for anything that isn't simply live.
 */
function GameRow({ game }: { game: DirectoryGameCard }) {
  const status = getGameStatus(game.gameStatus);

  return (
    <DetailedAppRow
      listing={{ ...game, appTags: game.gameTags }}
      byline={game.developerName ? `by ${game.developerName}` : null}
      badge={
        status === "live" ? null : (
          <Badge size="sm" variant={getGameStatusBadgeVariant(status)}>
            {GAME_STATUS_LABELS[status]}
          </Badge>
        )
      }
    />
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
