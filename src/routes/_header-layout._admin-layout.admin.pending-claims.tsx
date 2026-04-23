import * as stylex from "@stylexjs/stylex";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "../design-system/button";
import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";

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
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: gap.md,
    justifyContent: "space-between",
  },
  listStack: {
    gap: gap.xl,
  },
});

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
