import * as stylex from "@stylexjs/stylex";

import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { radius } from "../design-system/theme/radius.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import type { DirectoryListingCard } from "../integrations/tanstack-query/api-directory-listings.functions";

const styles = stylex.create({
  card: {
    borderRadius: radius["3xl"],
    cornerShape: "squircle",
    height: "100%",
    backgroundColor: uiColor.component1,
  },
  body: {
    flex: 1,
    gap: gap["2xl"],
    height: "100%",
    paddingBottom: verticalSpace["6xl"],
    paddingLeft: horizontalSpace["6xl"],
    paddingRight: horizontalSpace["6xl"],
    paddingTop: verticalSpace["6xl"],
  },
  description: {
    flex: 1,
    minHeight: 0,
  },
  title: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  },
});

/**
 * Rendered inside a featured grid slot when the listing has no `heroImageUrl`.
 * Keeps the oversized 16:9 tile from rendering empty by surfacing the
 * listing's identity (name + tagline) instead.
 */
export function FeaturedListingFallbackCard({
  listing,
}: {
  listing: Pick<
    DirectoryListingCard,
    "name" | "tagline" | "description" | "iconUrl"
  >;
}) {
  return (
    <Card style={styles.card}>
      <Flex direction="column" style={styles.body}>
        <Avatar
          alt={listing.name}
          fallback={getInitials(listing.name)}
          size="xl"
          src={listing.iconUrl || undefined}
        />
        <Text size="3xl" weight="semibold" style={styles.title}>
          {listing.name}
        </Text>
        <Body variant="secondary" style={styles.description}>
          {listing.tagline || listing.description}
        </Body>
      </Flex>
    </Card>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
