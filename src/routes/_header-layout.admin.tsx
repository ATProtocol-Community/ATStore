import * as stylex from "@stylexjs/stylex";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Page } from "../design-system/page";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import {
  Body,
  Heading1,
  Heading2,
  SmallBody,
} from "../design-system/typography";
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
    maxWidth: "56rem",
  },
  row: {
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: gap.md,
    justifyContent: "space-between",
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
    <HeaderLayout.Page>
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
            <Flex direction="column" style={{ gap: gap.xl }}>
              {data.unverified.map((row) => (
                <Flex key={row.id} style={styles.row}>
                  <div>
                    <Body>{row.name}</Body>
                    <SmallBody>
                      {row.slug} · {row.verificationStatus}
                      {row.atUri ? ` · ${row.atUri}` : ""}
                    </SmallBody>
                  </div>
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
              ))}
            </Flex>
          )}

          <Heading2>Pending claims</Heading2>
          {data.pendingClaims.length === 0 ? (
            <Body>None.</Body>
          ) : (
            <Flex direction="column" style={{ gap: gap.xl }}>
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
    </HeaderLayout.Page>
  );
}
