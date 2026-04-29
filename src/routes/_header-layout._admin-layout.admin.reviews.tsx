import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink } from "@tanstack/react-router";
import { Fragment } from "react";

import { Avatar } from "../design-system/avatar";
import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { RestrictedMarkdownContent } from "../components/restricted-markdown-content";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/product-reviews-route";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/reviews",
)({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      adminApi.getRecentReviewsQueryOptions,
    );
  },
  component: AdminReviewsPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "60rem",
  },
  listStack: {
    gap: gap["3xl"],
  },
  row: {
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: gap.md,
    justifyContent: "space-between",
    width: "100%",
  },
  authorRow: {
    alignItems: "center",
    gap: gap.lg,
    minWidth: 0,
  },
  authorMeta: {
    minWidth: 0,
  },
  reviewBlock: {
    backgroundColor: uiColor.component1,
    borderRadius: radius.md,
    marginTop: verticalSpace.md,
    maxWidth: "100%",
    paddingBottom: verticalSpace.lg,
    paddingLeft: horizontalSpace.lg,
    paddingRight: horizontalSpace.lg,
    paddingTop: verticalSpace.lg,
  },
  listingRow: {
    alignItems: "center",
    gap: gap.md,
    minWidth: 0,
  },
  listingIcon: {
    borderRadius: "8px",
    flexShrink: 0,
    height: "32px",
    objectFit: "cover",
    width: "32px",
  },
  ratingActions: {
    alignItems: "center",
    flexShrink: 0,
    gap: gap.sm,
  },
});

const ProductLink = createLink(Link);

function bskyProfileUrl(didOrHandle: string) {
  const actor = didOrHandle.trim().replace(/^@+/, "");
  return `https://bsky.app/profile/${encodeURIComponent(actor)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminReviewsPage() {
  const { data } = useSuspenseQuery(adminApi.getRecentReviewsQueryOptions);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Heading1>Recent reviews</Heading1>
        <SmallBody>
          All product reviews across the directory, newest first. Use this to
          spot abuse, spam, or missing context that needs moderation.
        </SmallBody>

        <Card>
          <CardHeader>
            <CardTitle>Reviews ({data.length})</CardTitle>
          </CardHeader>
          <CardBody>
            {data.length === 0 ? (
              <Body>None.</Body>
            ) : (
              <Flex direction="column" style={styles.listStack}>
                {data.map((r, i) => {
                  const handle = r.authorHandle?.trim() || null;
                  const displayName = r.authorDisplayName?.trim() || null;
                  const authorLabel =
                    displayName ||
                    (handle ? `@${handle}` : null) ||
                    (r.authorDid.length > 16
                      ? `${r.authorDid.slice(0, 10)}…`
                      : r.authorDid);
                  const profileActor = handle || r.authorDid;
                  return (
                    <Fragment key={r.id}>
                      <Flex direction="column" gap="2xl">
                        <Flex style={styles.row}>
                          <ProductLink
                            params={{
                              productId: getDirectoryListingSlug({
                                name: r.listingName,
                                slug: r.listingSlug,
                              }),
                            }}
                            to="/products/$productId"
                          >
                            <Flex style={styles.listingRow}>
                              {r.listingIconUrl ? (
                                <img
                                  src={r.listingIconUrl}
                                  alt=""
                                  {...stylex.props(styles.listingIcon)}
                                />
                              ) : null}
                              <Body>{r.listingName}</Body>
                            </Flex>
                          </ProductLink>
                          <Flex style={styles.ratingActions}>
                            <StarRating
                              rating={r.rating}
                              showReviewCount={false}
                            />
                            <Text size="sm" variant="secondary">
                              {formatDate(r.reviewCreatedAt)}
                            </Text>
                          </Flex>
                        </Flex>

                        <Flex style={styles.authorRow}>
                          <Avatar
                            alt={authorLabel}
                            fallback={getInitials(authorLabel)}
                            size="sm"
                            src={r.authorAvatarUrl || undefined}
                          />
                          <Flex
                            direction="column"
                            gap="xs"
                            style={styles.authorMeta}
                          >
                            <Link
                              href={bskyProfileUrl(profileActor)}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <Text size="sm" weight="semibold">
                                {authorLabel}
                              </Text>
                            </Link>
                            {handle ? (
                              <Text size="xs" variant="secondary">
                                @{handle}
                              </Text>
                            ) : null}
                            <Text size="xs" variant="secondary">
                              {r.authorDid}
                            </Text>
                          </Flex>
                        </Flex>

                        {r.text && r.text.trim() !== "" ? (
                          <div {...stylex.props(styles.reviewBlock)}>
                            <RestrictedMarkdownContent
                              compact
                              content={r.text}
                              paragraphVariant="secondary"
                            />
                          </div>
                        ) : (
                          <Text size="sm" variant="secondary">
                            (No review text.)
                          </Text>
                        )}
                      </Flex>
                      {i < data.length - 1 && <Separator />}
                    </Fragment>
                  );
                })}
              </Flex>
            )}
          </CardBody>
        </Card>
      </Flex>
    </Page.Root>
  );
}
