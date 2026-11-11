import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { ListingIcon } from "../components/shelf/ListingIcon";
import { BackLink } from "../components/shelf/Section";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontFamily } from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";

const styles = stylex.create({
  page: {
    marginInline: "auto",
    maxWidth: 820,
    paddingBottom: { default: 56, [breakpoints.md]: 88 },
    paddingTop: { default: 24, [breakpoints.md]: 36 },
  },
  chrome: {
    alignItems: "center",
    columnGap: { default: 14, [breakpoints.md]: 18 },
    display: "flex",
    marginBottom: 32,
    marginTop: 12,
    minWidth: 0,
  },
  icon: {
    borderRadius: { default: 13, [breakpoints.md]: 16 },
    fontSize: { default: 22, [breakpoints.md]: 28 },
    height: { default: 52, [breakpoints.md]: 64 },
    width: { default: 52, [breakpoints.md]: 64 },
  },
  text: {
    minWidth: 0,
  },
  name: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 30, [breakpoints.md]: 40 },
    fontWeight: 750,
    letterSpacing: "-0.025em",
    lineHeight: 1,
    overflowWrap: "anywhere",
  },
  tagline: {
    color: uiColor.text1,
    marginBottom: 0,
    marginTop: 6,
  },
});

/**
 * Compact listing chrome for the reviews sub-pages: a back link, the icon,
 * name and tagline, then the page content in a narrow column.
 */
export function ProductReviewsPageChrome({
  productId,
  productSlug,
  children,
}: {
  productId: string;
  productSlug: string;
  children: ReactNode;
}) {
  const detailQuery =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);
  const { data: listing } = useSuspenseQuery(detailQuery);

  if (!listing) {
    throw notFound();
  }

  return (
    <div {...stylex.props(styles.page)}>
      <BackLink to="/products/$productId" params={{ productId: productSlug }}>
        Back to {listing.name}
      </BackLink>

      <div {...stylex.props(styles.chrome)}>
        <ListingIcon
          name={listing.name}
          src={listing.iconUrl}
          size={64}
          style={styles.icon}
        />
        <div {...stylex.props(styles.text)}>
          <h1 {...stylex.props(styles.name)}>{listing.name}</h1>
          {listing.tagline ? (
            <p {...stylex.props(styles.tagline)}>{listing.tagline}</p>
          ) : null}
        </div>
      </div>

      {children}
    </div>
  );
}
