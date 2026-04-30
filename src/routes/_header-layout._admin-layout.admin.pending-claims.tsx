import * as stylex from "@stylexjs/stylex";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink } from "@tanstack/react-router";
import { Fragment, useState } from "react";

import { Button } from "../design-system/button";
import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { Separator } from "../design-system/separator";
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

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/pending-claims",
)({
  component: PendingClaimsPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "60rem",
  },
  row: {
    gap: gap.md,
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  listStack: {
    gap: gap["3xl"],
  },
  messageBlock: {
    borderRadius: radius.md,
    backgroundColor: uiColor.component1,
    marginTop: verticalSpace.md,
    maxWidth: "100%",
    paddingBottom: verticalSpace.lg,
    paddingLeft: horizontalSpace.lg,
    paddingRight: horizontalSpace.lg,
    paddingTop: verticalSpace.lg,
  },
  messageBody: {
    whiteSpace: "pre-wrap",
  },
});

const ProductLink = createLink(Link);

function bskyProfileUrl(didOrHandle: string) {
  const actor = didOrHandle.trim().replace(/^@+/, "");
  return `https://bsky.app/profile/${encodeURIComponent(actor)}`;
}

function PendingClaimsPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(adminApi.getAdminDashboardQueryOptions);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Heading1>Pending claims</Heading1>
        <SmallBody>
          Approve or reject ownership claims submitted by Bluesky accounts.
          Approving sets the listing&apos;s product account to the claimant.
        </SmallBody>

        <Card>
          <CardHeader>
            <CardTitle>Queue ({data.pendingClaims.length})</CardTitle>
          </CardHeader>
          <CardBody>
            {data.pendingClaims.length === 0 ? (
              <Body>None.</Body>
            ) : (
              <Flex direction="column" style={styles.listStack}>
                {data.pendingClaims.map((c, i) => (
                  <Fragment key={c.id}>
                    <Flex direction="column" gap="2xl">
                      <Flex style={styles.row}>
                        <Flex direction="column" gap="xl">
                          <ProductLink
                            params={{
                              productId: getDirectoryListingSlug({
                                name: c.listingName,
                                slug: c.listingSlug,
                              }),
                            }}
                            to="/products/$productId"
                          >
                            <Body>{c.listingName}</Body>
                          </ProductLink>
                          <SmallBody>
                            Claimant:{" "}
                            <Link
                              href={bskyProfileUrl(
                                c.claimantHandle ?? c.claimantDid,
                              )}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {c.claimantHandle
                                ? `@${c.claimantHandle.replace(/^@+/, "")}`
                                : c.claimantDid}
                            </Link>
                          </SmallBody>
                        </Flex>
                        <Flex gap="md">
                          <Button
                            isDisabled={busy === c.id}
                            onPress={async () => {
                              setBusy(c.id);
                              try {
                                await adminApi.setClaimStatus({
                                  data: { claimId: c.id, status: "approved" },
                                });
                                await refresh();
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            isDisabled={busy === c.id}
                            onPress={async () => {
                              setBusy(c.id);
                              try {
                                await adminApi.setClaimStatus({
                                  data: { claimId: c.id, status: "rejected" },
                                });
                                await refresh();
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            Reject
                          </Button>
                        </Flex>
                      </Flex>
                      {c.message.trim() === "" ? (
                        <Text size="sm" variant="secondary">
                          (No message provided.)
                        </Text>
                      ) : (
                        <div {...stylex.props(styles.messageBlock)}>
                          <Flex direction="column" gap="xl">
                            <Text size="sm" weight="semibold">
                              Proof / notes from submitter
                            </Text>
                            <Text
                              size="sm"
                              variant="secondary"
                              style={styles.messageBody}
                            >
                              {c.message}
                            </Text>
                          </Flex>
                        </div>
                      )}
                    </Flex>
                    {i < data.pendingClaims.length - 1 && <Separator />}
                  </Fragment>
                ))}
              </Flex>
            )}
          </CardBody>
        </Card>
      </Flex>
    </Page.Root>
  );
}
