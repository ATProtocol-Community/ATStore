import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";

import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { StarRating } from "../design-system/star-rating";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { getDirectoryListingHeroImageAlt } from "../lib/listing-copy";
import { FeaturedListingFallbackCard } from "./FeaturedListingFallbackCard";
import { HeroImage } from "./HeroImage";

const styles = stylex.create({
  listingLink: {
    textDecoration: "none",
    display: "block",
    height: "100%",
  },
  listingCard: {
    contentVisibility: "auto",
    height: "100%",
  },
  listingCardBody: {
    gap: gap["4xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  listingHeader: {
    gap: gap["2xl"],
  },
  listingInfo: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  listingTagline: {
    flexGrow: 1,
  },
  listingFooter: {
    alignItems: "center",
  },
  ratingRow: {
    flexWrap: "wrap",
  },
});

export function EcosystemListingCard({
  listing,
  featured = false,
}: {
  listing: DirectoryListingCard;
  featured?: boolean;
}) {
  return (
    <RouterLink
      to="/products/$productId"
      params={{ productId: getDirectoryListingSlug(listing) }}
      {...stylex.props(styles.listingLink)}
    >
      {featured && listing.heroImageUrl ? (
        <HeroImage
          alt={getDirectoryListingHeroImageAlt(listing)}
          glowIntensity={0.8}
          src={listing.heroImageUrl}
        />
      ) : featured ? (
        <FeaturedListingFallbackCard listing={listing} />
      ) : (
        <Card style={styles.listingCard}>
          <Flex direction="column" style={styles.listingCardBody}>
            <Flex gap="2xl" align="center" style={styles.listingHeader}>
              <Avatar
                alt={listing.name}
                fallback={getInitials(listing.name)}
                size="xl"
                src={listing.iconUrl || undefined}
              />
              <Flex direction="column" gap="xl" style={styles.listingInfo}>
                <Text size="xl" weight="semibold">
                  {listing.name}
                </Text>
                <Flex align="center" gap="lg" style={styles.ratingRow}>
                  <SmallBody variant="secondary">
                    @
                    {listing.productAccountHandle?.replace(/^@/, "") ||
                      "unknown"}
                  </SmallBody>
                </Flex>
              </Flex>
            </Flex>

            <Body variant="secondary" style={styles.listingTagline}>
              {listing.tagline}
            </Body>

            <div />

            <Flex justify="end" gap="xl" style={styles.listingFooter}>
              <Flex align="center" gap="lg" style={styles.ratingRow}>
                <SmallBody variant="secondary">
                  {listing.rating == null ? "—" : listing.rating.toFixed(1)}
                </SmallBody>
                <StarRating
                  rating={listing.rating}
                  reviewCount={listing.reviewCount}
                  showReviewCount
                />
              </Flex>
            </Flex>
          </Flex>
        </Card>
      )}
    </RouterLink>
  );
}
