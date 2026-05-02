import * as stylex from "@stylexjs/stylex";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "../design-system/button";
import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Heading1, SmallBody } from "../design-system/typography";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";

export const Route = createFileRoute(
  "/$locale/_header-layout/_admin-layout/admin/home-page-hero",
)({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingAppTagAssignmentsQueryOptions,
    );
  },
  component: HomePageHeroPage,
});

const HOME_HERO_SLOT_COUNT = 3;
const HOME_HERO_SLOT_LABELS = [
  "Featured app",
  "Spotlight app 1",
  "Spotlight app 2",
] as const;

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "60rem",
  },
  cardBody: {
    gap: gap["2xl"],
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

function HomePageHeroPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(adminApi.getAdminDashboardQueryOptions);
  const { data: appListings } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingAppTagAssignmentsQueryOptions,
  );
  const [busy, setBusy] = useState(false);
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
        <Heading1>Home page hero</Heading1>
        <SmallBody>
          Pick which verified apps appear in the homepage hero. Changes publish
          immediately.
        </SmallBody>

        <Card>
          <CardHeader>
            <CardTitle>Homepage app hero list</CardTitle>
          </CardHeader>
          <CardBody>
            <Flex direction="column" style={styles.cardBody}>
              <SmallBody style={styles.helperText}>
                Pick exactly {HOME_HERO_SLOT_COUNT} apps. Order controls
                featured first, then spotlights.
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
                    isDisabled={busy}
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
                isDisabled={busy}
                onPress={async () => {
                  const listingIds = heroListingIds.filter(
                    (id) => id.length > 0,
                  );
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

                  setBusy(true);
                  setHeroError(null);
                  try {
                    await adminApi.setHomePageHeroListings({
                      data: { listingIds },
                    });
                    await refresh();
                  } catch (error) {
                    setHeroError(
                      error instanceof Error
                        ? error.message
                        : "Failed to update homepage hero list.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save homepage hero list
              </Button>
            </Flex>
          </CardBody>
        </Card>
      </Flex>
    </Page.Root>
  );
}
