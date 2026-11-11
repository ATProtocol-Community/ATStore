import type { DirectoryAppTagGroup } from "../../../integrations/tanstack-query/api-directory-listings.functions";

import {
  formatAppTagLabel,
  getAppTagDescription,
  getAppTagSlug,
} from "../../../lib/app-tag-metadata";
import { GAMES_APP_TAG_SLUG } from "../../../lib/game-listing";

/** Games live on their own page, so the tile says so instead of listing names. */
const GAMES_TILE_DESCRIPTION =
  "Games built on the AT Protocol. They live on their own page.";

/** `getAppTagDescription` for a tag nobody wrote copy for: the generic sentence. */
function genericAppTagDescription(tag: string) {
  const sample = "\u0000";
  return getAppTagDescription(sample).replace(
    formatAppTagLabel(sample),
    formatAppTagLabel(tag),
  );
}

/**
 * Hand-written description for a tag, or null when the tag only has the
 * generic fallback sentence (tiles show a few app names instead).
 */
export function getWrittenAppTagDescription(tag: string): string | null {
  if (getAppTagSlug(tag) === GAMES_APP_TAG_SLUG) return GAMES_TILE_DESCRIPTION;
  const description = getAppTagDescription(tag);
  return description === genericAppTagDescription(tag) ? null : description;
}

/** "Tangled, npmx, wisp.place and more" from a tag group's most popular apps. */
export function summarizeTagApps(group: DirectoryAppTagGroup) {
  const names = group.listings.slice(0, 3).map((listing) => listing.name);
  return `${names.join(", ")}${group.count > names.length ? " and more" : ""}`;
}

/** Same order as the server (popularity), with the Games tile moved to the end. */
export function orderTagGroups(groups: Array<DirectoryAppTagGroup>) {
  const isGames = (group: DirectoryAppTagGroup) =>
    getAppTagSlug(group.tag) === GAMES_APP_TAG_SLUG;
  return [
    ...groups.filter((group) => !isGames(group)),
    ...groups.filter((group) => isGames(group)),
  ];
}
