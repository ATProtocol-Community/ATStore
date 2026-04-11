import * as stylex from "@stylexjs/stylex";
import { ExternalLink } from "lucide-react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link as AriaLink } from "react-aria-components";

import { Button } from "../design-system/button";
import { Card, CardBody, CardImage } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  Body,
  Heading1,
  Heading2,
  SmallBody,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { redirect } from "@tanstack/react-router";

import { adminApi } from "../integrations/tanstack-query/api-admin.functions";

export const Route = createFileRoute("/_header-layout/admin")({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(
        adminApi.getAdminDashboardQueryOptions,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "Unauthorized") {
        throw redirect({ to: "/login", search: { redirect: "/admin" } });
      }
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    gap: gap["3xl"],
    maxWidth: "60rem",
  },
  row: {
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: gap.md,
    justifyContent: "space-between",
  },
  card: {
    boxShadow: shadow.sm,
    width: "100%",
  },
  cardBody: {
    gap: gap["2xl"],
  },
  preview: {
    gap: gap.xl,
  },
  previewIcon: {
    borderRadius: "12px",
    flexShrink: 0,
    height: "64px",
    objectFit: "cover",
    width: "64px",
  },
  productLink: {
    alignItems: "center",
    display: "inline-flex",
    gap: gap.sm,
    paddingLeft: horizontalSpace.xs,
    textDecoration: "none",
  },
  listStack: {
    gap: gap.xl,
  },
});

function AdminPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(adminApi.getAdminDashboardQueryOptions);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.section}>
        <Heading1>Moderation</Heading1>
        <SmallBody>
          Unverified listings and pending claims. Handle{" "}
          <code>ADMIN_HANDLE</code> (default hipstersmoothie.com).
        </SmallBody>

        <Heading2>Unverified listings</Heading2>
        {data.unverified.length === 0 ? (
          <Body>None.</Body>
        ) : (
          <Flex direction="column" style={styles.listStack}>
            {data.unverified.map((row) => (
              <Card key={row.id} style={styles.card} size="lg">
                {row.heroImageUrl ? (
                  <CardImage
                    aspectRatio={16 / 9}
                    src={row.heroImageUrl}
                    alt=""
                  />
                ) : null}
                <CardBody>
                  <Flex direction="column" style={styles.cardBody}>
                    <Flex direction="column" style={styles.preview}>
                      <Flex gap="xl" align="start">
                        {row.iconUrl ? (
                          <img
                            src={row.iconUrl}
                            alt=""
                            {...stylex.props(styles.previewIcon)}
                          />
                        ) : null}
                        <Flex direction="column" gap="xl">
                          <Text size="2xl" weight="bold">
                            {row.name}
                          </Text>
                          {row.tagline ? (
                            <Text size="base" variant="secondary">
                              {row.tagline}
                            </Text>
                          ) : null}
                          <Text size="sm" weight="bold">
                            {row.categorySlugs?.[0]
                              ? `${row.categorySlugs[0]}`
                              : ""}
                          </Text>
                          {row.externalUrl ? (
                            <AriaLink
                              href={row.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              {...stylex.props(styles.productLink)}
                            >
                              <Text size="sm" variant="secondary">
                                View product
                              </Text>
                              <ExternalLink size={14} />
                            </AriaLink>
                          ) : null}
                        </Flex>
                      </Flex>
                    </Flex>
                    <Flex gap="md">
                      <Button
                        isDisabled={busy === row.id}
                        onPress={async () => {
                          setBusy(row.id);
                          try {
                            await adminApi.setListingVerification({
                              data: { listingId: row.id, status: "verified" },
                            });
                            await refresh();
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        Verify
                      </Button>
                      <Button
                        variant="secondary"
                        isDisabled={busy === row.id}
                        onPress={async () => {
                          setBusy(row.id);
                          try {
                            await adminApi.setListingVerification({
                              data: { listingId: row.id, status: "rejected" },
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
                </CardBody>
              </Card>
            ))}
          </Flex>
        )}

        <Heading2>Pending claims</Heading2>
        {data.pendingClaims.length === 0 ? (
          <Body>None.</Body>
        ) : (
          <Flex direction="column" style={styles.listStack}>
            {data.pendingClaims.map((c) => (
              <Flex key={c.id} style={styles.row}>
                <div>
                  <Body>{c.claimantDid}</Body>
                  <SmallBody>
                    listing {c.storeListingId} · {c.status}
                  </SmallBody>
                </div>
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
            ))}
          </Flex>
        )}
      </Flex>
    </Page.Root>
  );
}
