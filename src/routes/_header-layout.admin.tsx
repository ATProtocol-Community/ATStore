import * as stylex from "@stylexjs/stylex";
import { ExternalLink } from "lucide-react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link as AriaLink } from "react-aria-components";

import { Button } from "../design-system/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardImage,
  CardTitle,
} from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { redirect } from "@tanstack/react-router";

import { adminApi } from "../integrations/tanstack-query/api-admin.functions";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";

export const Route = createFileRoute("/_header-layout/admin")({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(
        adminApi.getAdminDashboardQueryOptions,
      );
      await context.queryClient.ensureQueryData(
        directoryListingApi.getDirectoryListingAppTagAssignmentsQueryOptions,
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
  formField: {
    maxWidth: "36rem",
    width: "100%",
  },
  comboList: {
    gap: gap.md,
    maxWidth: "36rem",
    width: "100%",
  },
  helperText: {
    maxWidth: "46rem",
  },
});

const HOME_HERO_SLOT_COUNT = 3;
const HOME_HERO_SLOT_LABELS = [
  "Featured app",
  "Spotlight app 1",
  "Spotlight app 2",
] as const;

function AdminPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(adminApi.getAdminDashboardQueryOptions);
  const { data: appListings } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingAppTagAssignmentsQueryOptions,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [heroListingIds, setHeroListingIds] = useState<string[]>(() =>
    Array.from({ length: HOME_HERO_SLOT_COUNT }, () => ""),
  );
  const [heroError, setHeroError] = useState<string | null>(null);

  useEffect(() => {
    const next = Array.from({ length: HOME_HERO_SLOT_COUNT }, () => "");
    for (const row of data.homePageHeroListings) {
      if (row.position >= 0 && row.position < HOME_HERO_SLOT_COUNT) {
        next[row.position] = row.id;
      }
    }
    setHeroListingIds(next);
  }, [data.homePageHeroListings]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin"] }),
      queryClient.invalidateQueries({ queryKey: ["storeListings", "home"] }),
    ]);
  }

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Heading1>Moderation</Heading1>
        <SmallBody>
          Unverified listings and pending claims. Handle{" "}
          <code>ADMIN_HANDLE</code> (default hipstersmoothie.com).
        </SmallBody>

        <Card>
          <CardHeader>
            <CardTitle>Homepage app hero list</CardTitle>
          </CardHeader>
          <CardBody>
            <SmallBody style={styles.helperText}>
              Pick exactly {HOME_HERO_SLOT_COUNT} apps. Order controls featured
              first, then spotlights.
            </SmallBody>
            <Flex direction="column" style={styles.comboList}>
              {HOME_HERO_SLOT_LABELS.map((label, index) => (
                <ComboBox
                  key={label}
                  style={styles.formField}
                  label={label}
                  items={appListings.map((listing) => ({
                    id: listing.id,
                    label: listing.name,
                  }))}
                  isDisabled={busy === "home-hero"}
                  placeholder="Select an app"
                  selectedKey={heroListingIds[index] || null}
                  onSelectionChange={(key) => {
                    const next = [...heroListingIds];
                    next[index] = key ? String(key) : "";
                    setHeroListingIds(next);
                  }}
                >
                  {(item) => (
                    <ComboBoxItem id={item.id}>{item.label}</ComboBoxItem>
                  )}
                </ComboBox>
              ))}
            </Flex>
            {heroError ? <SmallBody>{heroError}</SmallBody> : null}
            <Flex direction="column" gap="md">
              {data.homePageHeroListings.map((row) => (
                <SmallBody key={row.id}>
                  {row.position + 1}. {row.name} ({row.id})
                </SmallBody>
              ))}
            </Flex>
            <Button
              isDisabled={busy === "home-hero"}
              onPress={async () => {
                const listingIds = heroListingIds.filter((id) => id.length > 0);
                if (listingIds.length !== HOME_HERO_SLOT_COUNT) {
                  setHeroError(
                    `Please select ${String(HOME_HERO_SLOT_COUNT)} apps before saving.`,
                  );
                  return;
                }
                if (new Set(listingIds).size !== listingIds.length) {
                  setHeroError("Please select three different apps.");
                  return;
                }

                setBusy("home-hero");
                setHeroError(null);
                try {
                  await adminApi.setHomePageHeroListings({
                    data: {
                      listingIds,
                    },
                  });
                  await refresh();
                } catch (error) {
                  setHeroError(
                    error instanceof Error
                      ? error.message
                      : "Failed to update homepage hero list.",
                  );
                } finally {
                  setBusy(null);
                }
              }}
            >
              Save homepage hero list
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unverified listings</CardTitle>
          </CardHeader>
          <CardBody>
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
                                  data: {
                                    listingId: row.id,
                                    status: "verified",
                                  },
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
                                  data: {
                                    listingId: row.id,
                                    status: "rejected",
                                  },
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
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending claims</CardTitle>
          </CardHeader>
          <CardBody>
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
          </CardBody>
        </Card>
      </Flex>
    </Page.Root>
  );
}
