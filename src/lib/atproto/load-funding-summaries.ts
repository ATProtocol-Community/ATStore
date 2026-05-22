/**
 * Loader for at.fund funding records on the product detail page.
 *
 * `loadFundingDetailForDid` fetches the actual contribute / channel / plan / dependency
 * rows for one DID so the page can render a full panel matching at.fund's
 * "Funding / Depends on" layout.
 */
import type { Database } from "#/db/index.server";

import * as schema from "#/db/schema";
import {
  deriveChannelLabel,
  formatFundingAmount,
} from "#/lib/atproto/fund-format";
import { fetchBlueskyPublicProfilesBatch } from "#/lib/bluesky-public-profile";
import { count, eq } from "drizzle-orm";

/**
 * One pill on the funding chip row — pre-computed server-side so the panel can render
 * the at.fund-style channel pills without duplicating join logic in JSX.
 */
export type FundingChipView = {
  /** Stable key (channel atUri or `plan-only:<plan atUri>` for unattached plans). */
  key: string;
  /** Display label (e.g. "Open Collective", "Ko-fi"). */
  label: string;
  /** Pre-formatted price suffix (e.g. "$10/mo") when a plan references this channel. */
  price: string | null;
  /** Outbound URL — null when the channel has no public URL (bank / cheque). */
  url: string | null;
};

export type FundingSummary = {
  /** True iff a `fund.at.actor.declaration` row exists for this DID. */
  hasDeclaration: boolean;
  /** `fund.at.funding.contribute#url` — null when the steward hasn't published one. */
  contributeUrl: string | null;
  /** Optional human-readable label for the contribute URL. */
  contributeLabel: string | null;
  channelCount: number;
  planCount: number;
  /** Number of `fund.at.graph.dependency` rows where `subjectDid = did`. */
  dependentCount: number;
  /**
   * Channel-and-plan combos formatted for the listing-card chip row. Sorted by:
   *   1. channels with active plan reference (price-bearing) before plain channels,
   *   2. lower amount first within priced channels,
   *   3. alphabetical fallback.
   */
  chips: Array<FundingChipView>;
};

export type FundingChannelView = {
  atUri: string;
  rkey: string;
  channelType: string;
  channelUri: string | null;
  description: string | null;
};

export type FundingPlanView = {
  atUri: string;
  rkey: string;
  status: string | null;
  name: string;
  description: string | null;
  /** Smallest currency unit (cents for USD); null when omitted. String when read from jsonb snapshots. */
  amount: bigint | string | null;
  currency: string | null;
  frequency: string | null;
  channelAtUris: Array<string>;
};

/**
 * One end of a `fund.at.graph.dependency` edge with the relevant DID's Bluesky profile
 * resolved for display. The listing → upstream direction ("Depends on"): `subjectDid`
 * is the upstream we point to.
 *
 * `handle` / `displayName` / `avatarUrl` are populated from `public.api.bsky.app` and
 * fall back to null when resolution fails.
 */
export type FundingDependencyView = {
  /** AT URI of the dependency record itself (for keying in lists). */
  atUri: string;
  /** DID of the entity being shown — upstream for `dependencies`, downstream for `provides`. */
  subjectDid: string;
  /** Optional human-readable label authored on the record. */
  label: string | null;
  /** Resolved at render-time from public.api.bsky.app. */
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type FundingDetail = FundingSummary & {
  contribute: { url: string; label: string | null } | null;
  channels: Array<FundingChannelView>;
  plans: Array<FundingPlanView>;
  /** Upstream dependencies the steward has declared, with profile info hydrated. */
  dependencies: Array<FundingDependencyView>;
};

type ChannelRow = {
  repoDid: string;
  atUri: string;
  channelType: string;
  channelUri: string | null;
  description: string | null;
};

type PlanRow = {
  repoDid: string;
  atUri: string;
  status: string | null;
  name: string;
  amount: bigint | null;
  currency: string | null;
  frequency: string | null;
  channelAtUris: Array<string> | null;
};

/**
 * Normalize a URL for loose equality comparisons — strips trailing slashes / query /
 * fragment and lowercases the host. Returns null on parse failure.
 */
function normalizeUrlForEquality(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

/**
 * Loose URL equality used to detect which channel matches the steward's `contribute.url`.
 * Two URLs differing only in trailing slash / case-on-host count as the same pointer.
 * Returns false on parse failure so we never throw out of a sort comparator.
 */
export function urlsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeUrlForEquality(left);
  const b = normalizeUrlForEquality(right);
  return a !== null && a === b;
}

/**
 * Build the per-DID chip array. For each channel, find the first active plan that lists it
 * in `channelAtUris` and use that plan's price. Plans without any channel ref render as
 * standalone pills (rare — typically channels carry the URLs).
 *
 * `contributeUrl` (when present) pins the channel that matches the steward's canonical
 * `fund.at.funding.contribute.url` to the front of the row — that's the URL the Fund
 * button up by the heading dispatches to, so it should read first.
 */
function buildChipsForDid(
  channels: ReadonlyArray<ChannelRow>,
  plans: ReadonlyArray<PlanRow>,
  contributeUrl: string | null,
): Array<FundingChipView> {
  const channelToPlan = new Map<string, PlanRow>();
  for (const plan of plans) {
    if (plan.status === "inactive") continue;
    for (const atUri of plan.channelAtUris ?? []) {
      if (!channelToPlan.has(atUri)) channelToPlan.set(atUri, plan);
    }
  }

  const chips: Array<FundingChipView> = channels.map((c) => {
    const plan = channelToPlan.get(c.atUri);
    return {
      key: c.atUri,
      label: deriveChannelLabel(c),
      price: plan
        ? formatFundingAmount(plan.amount, plan.currency, plan.frequency)
        : null,
      url:
        c.channelUri && /^https?:/i.test(c.channelUri.trim())
          ? c.channelUri.trim()
          : null,
    };
  });

  // Plans with no channel reference (rare — render as standalone pills).
  for (const plan of plans) {
    if (plan.status === "inactive") continue;
    if ((plan.channelAtUris ?? []).length > 0) continue;
    chips.push({
      key: `plan-only:${plan.atUri}`,
      label: plan.name,
      price: formatFundingAmount(plan.amount, plan.currency, plan.frequency),
      url: null,
    });
  }

  // Sort: contribute-matching channel first (the Fund button's destination), then
  // priced channels (plans-attached) before plain ones, then alphabetical fallback.
  chips.sort((a, b) => {
    const aIsContribute = urlsMatch(a.url, contributeUrl) ? 0 : 1;
    const bIsContribute = urlsMatch(b.url, contributeUrl) ? 0 : 1;
    if (aIsContribute !== bIsContribute) return aIsContribute - bIsContribute;
    const aPriced = a.price ? 0 : 1;
    const bPriced = b.price ? 0 : 1;
    if (aPriced !== bPriced) return aPriced - bPriced;
    return a.label.localeCompare(b.label);
  });

  return chips;
}

/**
 * Hydrate the full funding panel for a single DID. Returns null for DIDs we have no
 * declaration for so the detail page can render nothing without further checks.
 */
export async function loadFundingDetailForDid(
  db: Database,
  rawDid: string | null | undefined,
): Promise<FundingDetail | null> {
  const did = rawDid?.trim();
  if (!did?.startsWith("did:")) return null;

  const [declarationRow] = await db
    .select({ repoDid: schema.fundActorDeclarations.repoDid })
    .from(schema.fundActorDeclarations)
    .where(eq(schema.fundActorDeclarations.repoDid, did))
    .limit(1);
  if (!declarationRow) return null;

  const [
    contributeRows,
    channelRows,
    planRows,
    dependCountRows,
    /**
     * Full dependency rows where `repoDid = did` (author side) → "Depends on".
     * `subjectDid` on each row is the upstream entity to display.
     */
    dependencyRows,
  ] = await Promise.all([
    db
      .select({
        url: schema.fundFundingContributes.url,
        label: schema.fundFundingContributes.label,
      })
      .from(schema.fundFundingContributes)
      .where(eq(schema.fundFundingContributes.repoDid, did))
      .limit(1),
    db
      .select({
        atUri: schema.fundFundingChannels.atUri,
        rkey: schema.fundFundingChannels.rkey,
        channelType: schema.fundFundingChannels.channelType,
        channelUri: schema.fundFundingChannels.channelUri,
        description: schema.fundFundingChannels.description,
      })
      .from(schema.fundFundingChannels)
      .where(eq(schema.fundFundingChannels.repoDid, did)),
    db
      .select({
        atUri: schema.fundFundingPlans.atUri,
        rkey: schema.fundFundingPlans.rkey,
        status: schema.fundFundingPlans.status,
        name: schema.fundFundingPlans.name,
        description: schema.fundFundingPlans.description,
        amount: schema.fundFundingPlans.amount,
        currency: schema.fundFundingPlans.currency,
        frequency: schema.fundFundingPlans.frequency,
        channelAtUris: schema.fundFundingPlans.channelAtUris,
      })
      .from(schema.fundFundingPlans)
      .where(eq(schema.fundFundingPlans.repoDid, did)),
    db
      .select({ n: count() })
      .from(schema.fundGraphDependencies)
      .where(eq(schema.fundGraphDependencies.subjectDid, did)),
    db
      .select({
        atUri: schema.fundGraphDependencies.atUri,
        subjectDid: schema.fundGraphDependencies.subjectDid,
        label: schema.fundGraphDependencies.label,
      })
      .from(schema.fundGraphDependencies)
      .where(eq(schema.fundGraphDependencies.repoDid, did)),
  ]);

  const contribute = contributeRows[0]
    ? { url: contributeRows[0].url, label: contributeRows[0].label }
    : null;

  const channels: Array<FundingChannelView> = channelRows.map((r) => ({
    atUri: r.atUri,
    rkey: r.rkey,
    channelType: r.channelType,
    channelUri: r.channelUri,
    description: r.description,
  }));

  const plans: Array<FundingPlanView> = planRows.map((r) => ({
    atUri: r.atUri,
    rkey: r.rkey,
    status: r.status,
    name: r.name,
    description: r.description,
    amount: r.amount ?? null,
    currency: r.currency,
    frequency: r.frequency,
    channelAtUris: r.channelAtUris ?? [],
  }));

  /**
   * Resolve upstream profile info via the batched `app.bsky.actor.getProfiles` (up to 25
   * actors per HTTP call, returned as a `Map<did, profile|null>`). The per-request map
   * also serves as our memo cache, mirroring the pattern used by the listing-mentions
   * loader — failures and missing actors degrade to null without throwing.
   */
  const profilesByDid = await fetchBlueskyPublicProfilesBatch(
    dependencyRows.map((row) => row.subjectDid),
  );
  const dependencies: Array<FundingDependencyView> = dependencyRows.map(
    (row) => {
      const profile = profilesByDid.get(row.subjectDid) ?? null;
      return {
        atUri: row.atUri,
        subjectDid: row.subjectDid,
        label: row.label,
        handle: profile?.handle ?? null,
        displayName: profile?.displayName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      };
    },
  );

  const contributeUrl = contribute?.url ?? null;

  // Reuse the same chip computation we use for the listing-card hot path so the
  // detail page header can pull this if it ever needs the same compact pill row.
  const chips = buildChipsForDid(
    channelRows.map((c) => ({
      repoDid: did,
      atUri: c.atUri,
      channelType: c.channelType,
      channelUri: c.channelUri,
      description: c.description,
    })),
    planRows.map((p) => ({
      repoDid: did,
      atUri: p.atUri,
      status: p.status,
      name: p.name,
      amount: p.amount ?? null,
      currency: p.currency,
      frequency: p.frequency,
      channelAtUris: p.channelAtUris ?? null,
    })),
    contributeUrl,
  );

  /**
   * Sort the raw `channels` array the same way `buildChipsForDid` sorts chips so the
   * `<FundingPopoverChip/>` (which iterates `channels` directly) shows the
   * contribute-matching channel first too. Plans-attached channels come next, then
   * alphabetical.
   */
  const sortedChannels: Array<FundingChannelView> = [...channels].toSorted(
    (a, b) => {
      const aIsContribute = urlsMatch(a.channelUri, contributeUrl) ? 0 : 1;
      const bIsContribute = urlsMatch(b.channelUri, contributeUrl) ? 0 : 1;
      if (aIsContribute !== bIsContribute) return aIsContribute - bIsContribute;
      const aHasPlan = plans.some((p) => p.channelAtUris.includes(a.atUri))
        ? 0
        : 1;
      const bHasPlan = plans.some((p) => p.channelAtUris.includes(b.atUri))
        ? 0
        : 1;
      if (aHasPlan !== bHasPlan) return aHasPlan - bHasPlan;
      return deriveChannelLabel({
        channelType: a.channelType,
        channelUri: a.channelUri,
        description: a.description,
      }).localeCompare(
        deriveChannelLabel({
          channelType: b.channelType,
          channelUri: b.channelUri,
          description: b.description,
        }),
      );
    },
  );

  return {
    hasDeclaration: true,
    contributeUrl,
    contributeLabel: contribute?.label ?? null,
    channelCount: channels.length,
    planCount: plans.length,
    dependentCount: Number(dependCountRows[0]?.n ?? 0),
    chips,
    contribute,
    channels: sortedChannels,
    plans,
    dependencies,
  };
}
