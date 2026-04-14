import { normalizeAppTag } from "./app-tags";

const APP_TAG_DESCRIPTIONS: Record<string, string> = {
  analytics:
    "Dashboards, measurement tools, and reporting workflows that help teams understand growth, engagement, and performance.",
  automation:
    "Bots, schedulers, and workflow tools that reduce repetitive work and keep routine Bluesky tasks moving.",
  community:
    "Communities in the Atmosphere. These range from groups on social networks to shared Personal Data Servers (PDS).",
  "account tool":
    "Utilities for account setup, profile management, migration, and other identity-related maintenance tasks.",
  "creator tool":
    "Publishing, audience, and monetization tools built to support creators producing and distributing work on Bluesky.",
  design:
    "Visual, brand, and creative utilities for crafting graphics, assets, and polished presentation experiences.",
  "developer tool":
    "SDKs, testing utilities, infrastructure helpers, and technical tooling for developers building on the ecosystem.",
  moderation:
    "Safety, trust, and review tooling for filtering content, enforcing policy, and supporting moderation workflows.",
  "personal page":
    "Profile pages, personal sites, and handle-centric destinations that help people present identity, links, and verified presence on the network.",
  publishing:
    "Writing, newsletters, blogging, and reader-growth tools built to help creators publish on the open web and keep direct relationships with their audience.",
  social:
    "Social-layer apps focused on posting, discovery, conversation, and relationship-building across the network.",
  utility:
    "General-purpose helpers that make everyday Bluesky usage more convenient, efficient, or easier to customize.",
};

function normalizeAppTagSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatAppTagLabel(tag: string) {
  return tag.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getAppTagDescription(tag: string) {
  return (
    APP_TAG_DESCRIPTIONS[tag] ??
    `${formatAppTagLabel(tag)} apps grouped around a shared workflow, use case, or capability across the Bluesky ecosystem.`
  );
}

export function formatAppTagCount(count: number) {
  return `${count} ${count === 1 ? "app" : "apps"}`;
}

export function getAppTagSlug(tag: string) {
  const normalizedTag = normalizeAppTag(tag) ?? "";
  const canonicalTag = normalizedTag.replace(/ tool$/, "");

  return canonicalTag.replace(/\s+/g, "-");
}

export function getAppTagHref(tag: string) {
  return `/apps/${getAppTagSlug(tag)}`;
}

export function findAppTagBySlug(tags: Iterable<string>, slug: string) {
  const normalizedSlug = normalizeAppTagSlug(slug);

  for (const tag of tags) {
    const normalizedTag = normalizeAppTag(tag);
    if (!normalizedTag) {
      continue;
    }

    if (getAppTagSlug(normalizedTag) === normalizedSlug) {
      return normalizedTag;
    }
  }

  return null;
}
