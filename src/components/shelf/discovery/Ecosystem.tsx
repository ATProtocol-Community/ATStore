import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import type { DirectoryListingCard } from "../../../integrations/tanstack-query/api-directory-listings.functions";
import type { DirectoryCategoryTreeNode } from "../../../lib/directory-categories";

import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { shadow } from "../../../design-system/theme/shadow.stylex";
import { fontWeight } from "../../../design-system/theme/typography.stylex";
import { getDirectoryListingSlug } from "../../../lib/directory-listing-slugs";
import { ListingIcon } from "../ListingIcon";
import { ListingRow } from "../ListingRow";
import { MoreLink, SectionHeader, ShelfSection } from "../Section";
import {
  getEcosystemBranchAnchor,
  getEcosystemBranchBlurb,
} from "./ecosystem-copy";

/** Rows beside the lead image in the first branch. */
const LEAD_ROWS = 4;
/** Rows (two columns) in every other branch. */
const BRANCH_ROWS = 6;

const styles = stylex.create({
  root: {
    borderColor: { default: uiColor.border1, ":hover": uiColor.border2 },
    borderRadius: 18,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: 12,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    color: "inherit",
    columnGap: 14,
    display: "flex",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    maxWidth: { default: "100%", [breakpoints.md]: 360 },
    minWidth: 0,
    paddingLeft: 12,
    paddingRight: 16,
  },
  rootText: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    fontSize: 14,
    minWidth: 0,
  },
  rootName: {
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
  },
  rootTagline: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 13,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rootChevron: {
    color: uiColor.text2,
    flexShrink: 0,
  },
  jump: {
    marginInline: { default: -20, [breakpoints.md]: 0 },
    paddingInline: { default: 20, [breakpoints.md]: 0 },
    columnGap: 6,
    display: "flex",
    flexWrap: { default: "nowrap", [breakpoints.md]: "wrap" },
    rowGap: 6,
    scrollbarWidth: "none",
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    overflowX: { default: "auto", [breakpoints.md]: "visible" },
    paddingBottom: { default: 16, [breakpoints.md]: 8 },
  },
  pill: {
    borderColor: { default: uiColor.border1, ":hover": uiColor.text2 },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: 8,
    paddingInline: 14,
    textDecoration: "none",
    backgroundColor: uiColor.bg,
    color: uiColor.text2,
    flexShrink: 0,
    fontSize: 14,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    whiteSpace: "nowrap",
  },
  all: {
    paddingInline: 4,
    alignItems: "center",
    display: "inline-flex",
    flexShrink: 0,
    marginLeft: { default: 8, [breakpoints.md]: "auto" },
  },
  pillCount: {
    color: uiColor.text1,
    fontVariantNumeric: "tabular-nums",
    marginLeft: 6,
  },
  section: {
    scrollMarginTop: 72,
  },
  lead: {
    alignItems: "center",
    columnGap: 40,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "minmax(0, 1.1fr) minmax(0, 1fr)",
    },
    rowGap: 16,
  },
  frame: {
    borderRadius: { default: 16, [breakpoints.md]: 20 },
    overflow: "hidden",
    aspectRatio: "16 / 9",
    backgroundColor: uiColor.component1,
    boxShadow: { default: shadow.md, ":hover": shadow.lg },
    display: "block",
    outlineColor: uiColor.text2,
    outlineOffset: 3,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    position: "relative",
    transitionDuration: animationDuration.slow,
    transitionProperty: "box-shadow",
    "::after": {
      inset: 0,
      borderRadius: "inherit",
      boxShadow: `inset 0 0 0 1px ${uiColor.border1}`,
      content: "''",
      pointerEvents: "none",
      position: "absolute",
    },
  },
  frameImage: {
    display: "block",
    objectFit: "cover",
    transform: {
      default: null,
      [stylex.when.ancestor(":hover")]: "scale(1.015)",
    },
    transitionDuration: animationDuration.extremelySlow,
    transitionProperty: "transform",
    height: "100%",
    width: "100%",
  },
  rows: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  twoColumns: {
    columnGap: 40,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.lg]: "repeat(2, minmax(0, 1fr))",
    },
  },
});

/** The ecosystem's own app as a small linked card beside the hero. */
export function EcosystemRootCard({
  listing,
}: {
  listing: DirectoryListingCard;
}) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.root)}
    >
      <ListingIcon name={listing.name} src={listing.iconUrl} size={48} />
      <span {...stylex.props(styles.rootText)}>
        <span {...stylex.props(styles.rootName)}>{listing.name}</span>
        <span {...stylex.props(styles.rootTagline)}>{listing.tagline}</span>
      </span>
      <ChevronRight
        size={16}
        aria-hidden
        {...stylex.props(styles.rootChevron)}
      />
    </RouterLink>
  );
}

/** Pills that jump to each branch section, with its listing count. */
export function EcosystemJumpLinks({
  branches,
  allId,
}: {
  branches: Array<DirectoryCategoryTreeNode>;
  /** Category id for the trailing "All listings" link to Browse. */
  allId: string;
}) {
  return (
    <nav aria-label="Sections" {...stylex.props(styles.jump)}>
      {branches.map((branch) => (
        <a
          key={branch.id}
          href={`#${getEcosystemBranchAnchor(branch)}`}
          {...stylex.props(styles.pill)}
        >
          {branch.label}
          <span {...stylex.props(styles.pillCount)}>{branch.count}</span>
        </a>
      ))}
      <span {...stylex.props(styles.all)}>
        <MoreLink to="/apps" search={{ in: allId }}>
          All listings
        </MoreLink>
      </span>
    </nav>
  );
}

/**
 * One branch of the ecosystem. The first leads with a cover image and four
 * rows beside it; the rest are two columns of compact rows.
 */
export function EcosystemBranchSection({
  branch,
  listings,
  lead,
}: {
  branch: DirectoryCategoryTreeNode;
  listings: Array<DirectoryListingCard>;
  lead: boolean;
}) {
  const leadListing = lead
    ? listings.find((listing) => listing.heroImageUrl)
    : undefined;
  const rows = leadListing
    ? listings.filter((listing) => listing !== leadListing).slice(0, LEAD_ROWS)
    : listings.slice(0, BRANCH_ROWS);

  return (
    <ShelfSection id={getEcosystemBranchAnchor(branch)} style={styles.section}>
      <SectionHeader
        title={branch.label}
        description={getEcosystemBranchBlurb(branch)}
        action={
          <MoreLink to="/apps" search={{ in: branch.id }}>
            View all {branch.count}
          </MoreLink>
        }
      />
      {leadListing ? (
        <div {...stylex.props(styles.lead)}>
          <RouterLink
            to="/products/$productId"
            params={{ productId: getDirectoryListingSlug(leadListing) }}
            aria-label={leadListing.name}
            {...stylex.props(styles.frame)}
          >
            <img
              alt=""
              src={leadListing.heroImageUrl ?? undefined}
              loading="lazy"
              decoding="async"
              {...stylex.props(styles.frameImage)}
            />
          </RouterLink>
          <div {...stylex.props(styles.rows)}>
            {rows.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                variant="compact"
              />
            ))}
          </div>
        </div>
      ) : (
        <div {...stylex.props(styles.twoColumns)}>
          {rows.map((listing) => (
            <ListingRow key={listing.id} listing={listing} variant="compact" />
          ))}
        </div>
      )}
    </ShelfSection>
  );
}
