import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import { eq } from "drizzle-orm";

/** True when some public listing uses `did` as official product account. */
export async function hasStoreListingForProductDid(
  db: Database,
  did: string,
): Promise<boolean> {
  const trimmed = did.trim();
  if (!trimmed.startsWith("did:")) return false;
  const [row] = await db
    .select({ id: schema.storeListings.id })
    .from(schema.storeListings)
    .where(eq(schema.storeListings.productAccountDid, trimmed))
    .limit(1);
  return row != null;
}
