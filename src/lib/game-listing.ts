import type { GameDetails, GameStatus } from "./atproto/game-define-record";

/** Where game listings come from; credited on `/games` and game product pages. */
export const ATMOSPHERE_GAMES_URL = "https://atmosphere.games";

/** The app tag whose browse view is replaced by the dedicated `/games` section. */
export const GAMES_APP_TAG_SLUG = "games";

/**
 * Status buckets for filtering and badges. A missing status means the developer never set one,
 * which atmosphere.games treats as a playable game, and unknown values from newer lexicon
 * revisions fall back to the same bucket.
 */
export function getGameStatus(status: string | null | undefined): GameStatus {
  switch (status) {
    case "beta":
    case "coming":
    case "archived": {
      return status;
    }
    default: {
      return "live";
    }
  }
}

/**
 * Display order for status filters and search-param validation. Kept here rather than importing
 * `GAME_STATUSES` so client bundles don't pull in the define-record parser.
 */
export const GAME_STATUS_ORDER = [
  "live",
  "beta",
  "coming",
  "archived",
] as const satisfies ReadonlyArray<GameStatus>;

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  live: "Live",
  beta: "Beta",
  coming: "Coming soon",
  archived: "Archived",
};

export function getGameStatusBadgeVariant(
  status: GameStatus,
): "success" | "primary" | "warning" | "default" {
  switch (status) {
    case "live": {
      return "success";
    }
    case "beta": {
      return "primary";
    }
    case "coming": {
      return "warning";
    }
    case "archived": {
      return "default";
    }
  }
}

/** Primary call to action on a game's product page. */
export function getGamePlayLabel(status: GameStatus): string {
  switch (status) {
    case "coming": {
      return "Coming soon";
    }
    case "archived": {
      return "Archived";
    }
    default: {
      return "Play";
    }
  }
}

const GAME_CATEGORY_LABELS: Record<string, string> = {
  browser: "Browser game",
  download: "Download",
  physical: "Physical game",
  other: "Other",
};

export function getGameCategoryLabel(category: string): string {
  return (
    GAME_CATEGORY_LABELS[category] ??
    category.charAt(0).toUpperCase() + category.slice(1)
  );
}

/**
 * Game-only listings are built from the developer's `games.atmosphere.define` record, so they
 * can't be edited or claimed here. Listings merged with an AT Store record keep their own URI.
 */
export function isGameOnlyListing(listing: {
  atUri: string | null;
  game: GameDetails | null;
}): boolean {
  return listing.game != null && listing.atUri === listing.game.defineAtUri;
}
