import type { SQL } from "drizzle-orm";

import * as schema from "#/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * `store_listings` rows a review / favorite `subject` AT URI resolves to: the listing's own record
 * (`fyi.atstore.listing.detail` or, for game-only rows, `games.atmosphere.define`), the record it was
 * claimed from, or — for games — the linked define record and any define record it superseded.
 */
export function storeListingMatchesSubject(subject: string): SQL {
  const t = schema.storeListings;
  return sql`(${eq(t.atUri, subject)} OR ${eq(t.migratedFromAtUri, subject)} OR ${eq(t.gameDefineAtUri, subject)} OR ${subject} = ANY(${t.gameDefinePriorAtUris}))`;
}
