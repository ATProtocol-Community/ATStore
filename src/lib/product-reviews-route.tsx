import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createLink, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { Avatar } from "../design-system/avatar";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import {
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { getInitials } from "./get-initials";

const AppLink = createLink(Link);

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["11xl"],
    paddingTop: verticalSpace["6xl"],
  },
  backLinkRow: {
    alignItems: "center",
  },
  avatar: {
    flexShrink: 0,
    height: size["6xl"],
    width: size["6xl"],
  },
});

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
    <Page.Root variant="small" style={styles.page}>
      <Flex direction="column" gap="7xl">
        <Flex style={styles.backLinkRow}>
          <AppLink
            to="/products/$productId"
            params={{ productId: productSlug }}
          >
            <ChevronLeft />
            Back to product
          </AppLink>
        </Flex>

        <Flex gap="2xl" align="center">
          <Avatar
            alt={listing.name}
            fallback={getInitials(listing.name)}
            size="xl"
            src={listing.iconUrl || undefined}
            style={styles.avatar}
          />
          <Flex direction="column" gap="2xl">
            <Text
              font="title"
              size={{ default: "4xl", sm: "4xl" }}
              weight="semibold"
            >
              {listing.name}
            </Text>
            <SmallBody variant="secondary">{listing.tagline}</SmallBody>
          </Flex>
        </Flex>

        {children}
      </Flex>
    </Page.Root>
  );
}
