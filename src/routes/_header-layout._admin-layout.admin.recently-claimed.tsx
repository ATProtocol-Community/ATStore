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
      adminApi.getRecentlyClaimedListingsQueryOptions,
    );
  },
  component: AdminRecentlyClaimedPage,
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
  listingMedia: {
    alignItems: "center",
    gap: gap.lg,
    minWidth: 0,
  },
  listingIcon: {
    borderRadius: "12px",
    flexShrink: 0,
    height: "48px",
    objectFit: "cover",
    width: "48px",
  },
  listingMeta: {
    minWidth: 0,
  },
  externalLink: {
    alignItems: "center",
    display: "inline-flex",
    gap: gap.sm,
    paddingLeft: horizontalSpace.xs,
    textDecoration: "none",
  },
  claimColumn: {
    alignItems: "flex-end",
    flexShrink: 0,
    gap: gap.xs,
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

function AdminRecentlyClaimedPage() {
  const { data } = useSuspenseQuery(
    adminApi.getRecentlyClaimedListingsQueryOptions,
  );

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Heading1>Recently claimed listings</Heading1>
        <SmallBody>
          Newest by stored claim time when present; otherwise by directory date
          added (legacy PDS rows). Uses only those timestamps.
        </SmallBody>

        <Card>
          <CardHeader>
            <CardTitle>Claimed listings ({data.length})</CardTitle>
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
                            {row.claimedAt ? (
                              <Text size="sm">
                                Claimed {formatDate(row.claimedAt)}
                              </Text>
                            ) : (
                              <Text size="sm" variant="secondary">
                                Claim date not stored (pre-backfill migration)
                              </Text>
                            )}
                            <Text size="xs" variant="secondary">
                              Added {formatDate(row.createdAt)}
                            </Text>
                            <Text size="xs" variant="secondary">
                              {row.claimSource === "pds-migration"
                                ? "PDS migration"
                                : "Admin approval"}
                            </Text>
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
