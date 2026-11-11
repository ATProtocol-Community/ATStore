import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createLink } from "@tanstack/react-router";
import { BadgeCheck, Info } from "lucide-react";

import type { DirectoryListingDetail } from "../../../integrations/tanstack-query/api-directory-listings.functions";

import { Button } from "../../../design-system/button";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";
import { directoryListingApi } from "../../../integrations/tanstack-query/api-directory-listings.functions";
import {
  formatAppTagLabel,
  getAppTagLinkOptions,
} from "../../../lib/app-tag-metadata";
import { isGameOnlyListing } from "../../../lib/game-listing";
import { FundingPopoverChip } from "../../funding-popover-chip";
import { GameFactRows } from "../../GameDetailsPanel";
import { GermNetworkBadge } from "../../GermNetworkBadge";
import { ListingOAuthScopesPopoverChip } from "../../ListingOAuthScopesPopoverChip";
import { listingOAuthScopesPopoverChipShouldRender } from "../../ListingOAuthScopesPopoverChip.logic";
import {
  formatListingDate,
  getCategoryDisplayLabel,
  getDataProducerGroups,
  getDisplayCategorySlug,
  getListingLinkLabel,
  getUrlDomain,
} from "./listing-helpers";
import {
  DetailExternalLink,
  DetailLink,
  DetailList,
  DetailRow,
  PillLink,
  SmallArrowLink,
} from "./ListingParts";

const ButtonLink = createLink(Button);

const styles = stylex.create({
  aside: {
    alignSelf: "start",
    display: "flex",
    flexDirection: "column",
    position: { default: "static", [breakpoints.md]: "sticky" },
    rowGap: 20,
    minWidth: 0,
    top: 88,
  },
  prov: {
    padding: 18,
    borderColor: uiColor.border1,
    borderRadius: 16,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
    color: `color-mix(in srgb, ${uiColor.text2} 78%, transparent)`,
    fontSize: 14,
    lineHeight: 1.5,
  },
  provTitle: {
    alignItems: "center",
    color: uiColor.text2,
    columnGap: 8,
    display: "flex",
    fontWeight: fontWeight.semibold,
    marginBottom: 6,
  },
  provText: {
    margin: 0,
  },
  uri: {
    color: uiColor.text1,
    fontFamily: fontFamily.mono,
    fontSize: 12,
    lineHeight: 1.4,
    wordBreak: "break-all",
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  claim: {
    marginTop: 14,
  },
});

/** Sticky facts column: a definition list plus where the listing comes from. */
export function ListingSidebar({
  listing,
  productId,
  productSlug,
  hasCompatibleApps,
}: {
  listing: DirectoryListingDetail;
  productId: string;
  productSlug: string;
  hasCompatibleApps: boolean;
}) {
  const website = listing.externalUrl?.trim() || null;
  const domain = getUrlDomain(website);
  const handle = listing.productAccountHandle?.trim().replace(/^@/, "");
  const categorySlug = getDisplayCategorySlug(listing.categorySlugs);
  const producers = getDataProducerGroups(listing.oauthProbe?.oauthLexiconKeys);
  const showScopes =
    Boolean(website) &&
    listingOAuthScopesPopoverChipShouldRender({
      oauthProbe: listing.oauthProbe,
    });
  const germHref = listing.germDmHref?.trim() || null;
  const hasSource = listing.links.some((link) => link.type === "source");
  const hasDonate = listing.links.some((link) => link.type === "donate");
  const funding = listing.fundingDetail;
  const showFunding =
    funding != null &&
    (Boolean(funding.contribute?.url) ||
      funding.channels.length > 0 ||
      funding.plans.length > 0 ||
      funding.dependencies.length > 0);
  const listed = formatListingDate(listing.createdAt);
  const updated = formatListingDate(listing.updatedAt);

  return (
    <aside aria-label="About this listing" {...stylex.props(styles.aside)}>
      <DetailList>
        {website ? (
          <DetailRow term="Website">
            <DetailExternalLink href={website}>
              {domain ?? website}
            </DetailExternalLink>
          </DetailRow>
        ) : null}
        {handle || listing.productAccountDid ? (
          <DetailRow term="Account">
            <DetailExternalLink
              href={`https://bsky.app/profile/${listing.productAccountDid ?? handle}`}
            >
              {handle ? `@${handle}` : "Bluesky profile"}
            </DetailExternalLink>
          </DetailRow>
        ) : null}
        {categorySlug ? (
          <DetailRow term="Category">
            <DetailLink to="/apps" search={{ in: categorySlug }}>
              {getCategoryDisplayLabel(categorySlug)}
            </DetailLink>
          </DetailRow>
        ) : null}
        {listing.listingType === "game" && listing.game ? (
          <GameFactRows game={listing.game} />
        ) : null}
        {listing.appTags.length > 0 ? (
          <DetailRow term="Tags">
            {listing.appTags.map((tag) => (
              <PillLink key={tag} {...getAppTagLinkOptions(tag)}>
                {formatAppTagLabel(tag)}
              </PillLink>
            ))}
          </DetailRow>
        ) : null}
        {producers.length > 0 ? (
          <DetailRow term="Works with" stack>
            {producers.slice(0, 6).map((group) => (
              <DetailLink key={group} to="/apps" search={{ data: group }} mono>
                {group}
              </DetailLink>
            ))}
            {hasCompatibleApps ? (
              <SmallArrowLink
                to="/products/$productId/lexicon-compatible"
                params={{ productId: productSlug }}
                search={{ sort: "popular" }}
              >
                Compatible apps
              </SmallArrowLink>
            ) : null}
          </DetailRow>
        ) : hasCompatibleApps ? (
          <DetailRow term="Works with">
            <SmallArrowLink
              to="/products/$productId/lexicon-compatible"
              params={{ productId: productSlug }}
              search={{ sort: "popular" }}
            >
              Compatible apps
            </SmallArrowLink>
          </DetailRow>
        ) : null}
        {listing.links.length > 0 ? (
          <DetailRow term="Links">
            {listing.links.map((link, index) => (
              <DetailExternalLink
                key={`${link.type}-${link.url}-${String(index)}`}
                href={link.url}
              >
                {getListingLinkLabel(link)}
              </DetailExternalLink>
            ))}
          </DetailRow>
        ) : null}
        {showScopes && website ? (
          <DetailRow term="Permissions">
            <ListingOAuthScopesPopoverChip
              oauthProbe={listing.oauthProbe}
              storefrontUrl={website}
              devListingId={listing.id}
              devListingSlug={productSlug}
            />
          </DetailRow>
        ) : null}
        {hasSource || hasDonate || showFunding || germHref ? (
          <DetailRow term="Extras">
            {hasSource || hasDonate ? (
              <span>
                {[hasSource && "Open source", hasDonate && "Accepts donations"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
            {showFunding ? (
              <FundingPopoverChip
                funding={funding}
                productName={listing.name}
              />
            ) : null}
            {germHref ? <GermNetworkBadge href={germHref} /> : null}
          </DetailRow>
        ) : null}
        {listed ? <DetailRow term="Listed">{listed}</DetailRow> : null}
        {updated ? <DetailRow term="Updated">{updated}</DetailRow> : null}
      </DetailList>
      <ProvenanceCard listing={listing} productId={productId} />
    </aside>
  );
}

/**
 * Where the listing record lives. Store-managed listings carry the claim call
 * to action (formerly the "Unverified listing" banner).
 */
function ProvenanceCard({
  listing,
  productId,
}: {
  listing: DirectoryListingDetail;
  productId: string;
}) {
  const { data: editAccess } = useQuery(
    directoryListingApi.getProductListingEditAccessQueryOptions(productId),
  );
  const isGameOnly = isGameOnlyListing(listing);
  const uri = listing.atUri?.trim() || null;

  if (listing.isStoreManaged && !isGameOnly) {
    return (
      <div {...stylex.props(styles.prov)}>
        <div {...stylex.props(styles.provTitle)}>
          <Info size={16} aria-hidden />
          Listed by at-store
        </div>
        <p {...stylex.props(styles.provText)}>
          We added this listing from public information. Is it yours? Claim it
          to update details and links, publish from your own PDS, and respond to
          reviews.
        </p>
        {editAccess?.canEdit ? null : (
          <ButtonLink
            to="/product/claim"
            search={{ listing: listing.id }}
            variant="secondary"
            size="md"
            style={styles.claim}
          >
            Claim this listing
          </ButtonLink>
        )}
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.prov)}>
      <div {...stylex.props(styles.provTitle)}>
        <BadgeCheck size={16} aria-hidden />
        Published by the developer
      </div>
      <p {...stylex.props(styles.provText)}>
        {isGameOnly
          ? "This listing comes from the developer's record on atmosphere.games, so updates come straight from them."
          : "This listing is a record in the developer's own repo, so updates come straight from them."}
      </p>
      {uri ? <div {...stylex.props(styles.uri)}>{uri}</div> : null}
    </div>
  );
}
