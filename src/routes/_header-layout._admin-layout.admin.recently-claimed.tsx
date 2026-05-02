import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Fragment } from "react";
import { Link as AriaLink } from "react-aria-components";

import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { Separator } from "../design-system/separator";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/recently-claimed",
)({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      adminApi.getRecentListingsQueryOptions,
    );
  },
  component: AdminRecentListingsPage,
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
    gap: gap.md,
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  listingMedia: {
    gap: gap.lg,
    alignItems: "center",
    minWidth: 0,
  },
  listingIcon: {
    borderRadius: "12px",
    flexShrink: 0,
    objectFit: "cover",
    height: "48px",
    width: "48px",
  },
  listingMeta: {
    minWidth: 0,
  },
  externalLink: {
    gap: gap.sm,
    textDecoration: "none",
    alignItems: "center",
    display: "inline-flex",
    paddingLeft: horizontalSpace.xs,
  },
  claimColumn: {
    gap: gap.xs,
    alignItems: "flex-end",
    flexShrink: 0,
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

function statusLabel(row: {
  isClaimed: boolean;
  verificationStatus: "verified" | "rejected" | "unverified";
}) {
  if (row.isClaimed) return "Claimed";
  switch (row.verificationStatus) {
    case "verified": {
      return "Verified";
    }
    case "rejected": {
      return "Rejected";
    }
    case "unverified": {
      return "Submitted";
    }
  }
}

function AdminRecentListingsPage() {
  const { data } = useSuspenseQuery(adminApi.getRecentListingsQueryOptions);

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Heading1>Recent listings</Heading1>
        <SmallBody>
          Verified listings — both claimed and submitted — newest first. Sorted
          by stored claim time when present; otherwise by directory date added.
        </SmallBody>

        <Card>
          <CardHeader>
            <CardTitle>Listings ({data.length})</CardTitle>
          </CardHeader>
          <CardBody>
            {data.length === 0 ? (
              <Body>None.</Body>
            ) : (
              <Flex direction="column" style={styles.listStack}>
                {data.map((row, i) => {
                  const claimant = row.claimedByDid;
                  const productHandle =
                    row.productAccountHandle?.trim() || null;
                  const productAccountDid = row.productAccountDid || null;
                  return (
                    <Fragment key={row.id}>
                      <Flex direction="column" gap="2xl">
                        <Flex style={styles.row}>
                          <ProductLink
                            params={{
                              productId: getDirectoryListingSlug({
                                name: row.name,
                                slug: row.slug,
                              }),
                            }}
                            to="/products/$productId"
                          >
                            <Flex style={styles.listingMedia}>
                              {row.iconUrl ? (
                                <img
                                  src={row.iconUrl}
                                  alt=""
                                  {...stylex.props(styles.listingIcon)}
                                />
                              ) : null}
                              <Flex
                                direction="column"
                                gap="xs"
                                style={styles.listingMeta}
                              >
                                <Body>{row.name}</Body>
                                {row.tagline ? (
                                  <Text size="sm" variant="secondary">
                                    {row.tagline}
                                  </Text>
                                ) : null}
                                {row.externalUrl ? (
                                  <AriaLink
                                    href={row.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...stylex.props(styles.externalLink)}
                                  >
                                    <Text size="xs" variant="secondary">
                                      {row.externalUrl}
                                    </Text>
                                    <ExternalLink size={12} />
                                  </AriaLink>
                                ) : null}
                              </Flex>
                            </Flex>
                          </ProductLink>

                          <Flex direction="column" style={styles.claimColumn}>
                            <Text size="sm">{statusLabel(row)}</Text>
                            {row.isClaimed ? (
                              row.claimedAt ? (
                                <Text size="xs" variant="secondary">
                                  Claimed {formatDate(row.claimedAt)}
                                </Text>
                              ) : (
                                <Text size="xs" variant="secondary">
                                  Claim date not stored (pre-backfill migration)
                                </Text>
                              )
                            ) : null}
                            <Text size="xs" variant="secondary">
                              Added {formatDate(row.createdAt)}
                            </Text>
                            {row.claimSource ? (
                              <Text size="xs" variant="secondary">
                                {row.claimSource === "pds-migration"
                                  ? "PDS migration"
                                  : "Admin approval"}
                              </Text>
                            ) : null}
                            {claimant ? (
                              <Text size="xs" variant="secondary">
                                Claimed by{" "}
                                <Link
                                  href={bskyProfileUrl(claimant)}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {claimant}
                                </Link>
                              </Text>
                            ) : null}
                            {productHandle || productAccountDid ? (
                              <Text size="xs" variant="secondary">
                                Product account:{" "}
                                <Link
                                  href={bskyProfileUrl(
                                    productHandle ?? productAccountDid ?? "",
                                  )}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {productHandle
                                    ? `@${productHandle.replace(/^@+/, "")}`
                                    : productAccountDid}
                                </Link>
                              </Text>
                            ) : null}
                          </Flex>
                        </Flex>
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
