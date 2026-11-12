import type { DirectoryCategoryTreeNode } from "../../../lib/directory-categories";

/** Hand-written intros for ecosystems; others use the category description. */
const ECOSYSTEM_INTROS: Record<string, string> = {
  "apps/bluesky":
    "Bluesky apps and ecosystem tools: clients, analytics, schedulers and feeds made by independent developers on top of Bluesky.",
};

/** One-line blurbs for ecosystem branches; others use the category description. */
const ECOSYSTEM_BRANCH_BLURBS: Record<string, string> = {
  "apps/bluesky/client": "Other apps for reading and posting to Bluesky.",
  "apps/bluesky/tool":
    "Utilities that add to Bluesky: themes, backups, alerts, extensions.",
  "apps/bluesky/analytics":
    "Stats and insights about your account and audience.",
  "apps/bluesky/scheduling":
    "Plan posts ahead of time and publish at the right moment.",
  "apps/bluesky/feed-generators":
    "Custom feeds you can pin in any Bluesky client.",
  "apps/bluesky/moderation": "Labelers and tools for a calmer timeline.",
};

export function getEcosystemIntro(category: DirectoryCategoryTreeNode) {
  return ECOSYSTEM_INTROS[category.id] ?? category.description;
}

export function getEcosystemBranchBlurb(category: DirectoryCategoryTreeNode) {
  return ECOSYSTEM_BRANCH_BLURBS[category.id] ?? category.description;
}

/** Fragment id for a branch's section, e.g. `eco-client`. */
export function getEcosystemBranchAnchor(category: DirectoryCategoryTreeNode) {
  return `eco-${category.id.split("/").at(-1) ?? category.id}`;
}
