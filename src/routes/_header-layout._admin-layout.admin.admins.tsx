import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card, CardBody, CardHeader, CardTitle } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { superAdminApi } from "../integrations/tanstack-query/api-super-admin.functions";
import { user as userApi } from "../integrations/tanstack-query/api-user.functions";
import { isSuperAdminDid } from "../lib/super-admin";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/admins",
)({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      userApi.getSessionQueryOptions,
    );
    if (!isSuperAdminDid(session?.user?.did ?? null)) {
      throw redirect({ to: "/admin" });
    }
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(superAdminApi.listAdminsQueryOptions),
      context.queryClient.ensureQueryData(
        superAdminApi.listSignedInUsersQueryOptions,
      ),
    ]);
  },
  component: AdminAdminsPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "60rem",
  },
  grantForm: {
    gap: gap.lg,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  grantField: {
    flexBasis: "20rem",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: "16rem",
  },
  adminRow: {
    gap: gap.lg,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  adminIdentity: {
    gap: gap.lg,
    alignItems: "center",
    flexBasis: "auto",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  adminListStack: {
    gap: gap.xl,
  },
  suggestionName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
});

type StatusMessage = {
  tone: "success" | "critical";
  text: string;
};

type CandidateUser = {
  id: string;
  handle: string;
  name: string;
  image: string | null;
  isAdmin: boolean;
};

function AdminAdminsPage() {
  const queryClient = useQueryClient();
  const { data: admins } = useSuspenseQuery(
    superAdminApi.listAdminsQueryOptions,
  );
  const { data: signedInUsers } = useSuspenseQuery(
    superAdminApi.listSignedInUsersQueryOptions,
  );

  const [handleDraft, setHandleDraft] = useState("");
  const [status, setStatus] = useState<StatusMessage | null>(null);

  // Only suggest users we resolved a handle for and who aren't already admins —
  // those are the only actionable candidates for "grant admin".
  const candidateUsers = useMemo<Array<CandidateUser>>(
    () =>
      signedInUsers
        .filter(
          (row): row is typeof row & { handle: string } =>
            !row.isAdmin &&
            typeof row.handle === "string" &&
            row.handle.length > 0,
        )
        .map((row) => ({
          id: row.handle,
          handle: row.handle,
          name: row.name,
          image: row.image,
          isAdmin: row.isAdmin,
        })),
    [signedInUsers],
  );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: superAdminApi.listAdminsQueryOptions.queryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: superAdminApi.listSignedInUsersQueryOptions.queryKey,
        exact: true,
      }),
    ]);
  }

  const grantMutation = useMutation({
    mutationFn: async (handle: string) =>
      superAdminApi.grantAdminByHandle({ data: { handle } }),
    onSuccess: async (result) => {
      setStatus({
        tone: "success",
        text: result.alreadyAdmin
          ? `${result.handle} is already an admin.`
          : `Granted admin to ${result.handle}.`,
      });
      setHandleDraft("");
      await refresh();
    },
    onError: (error) => {
      setStatus({
        tone: "critical",
        text: error instanceof Error ? error.message : "Could not grant admin.",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) =>
      superAdminApi.revokeAdmin({ data: { userId } }),
    onSuccess: async () => {
      setStatus({ tone: "success", text: "Revoked admin." });
      await refresh();
    },
    onError: (error) => {
      setStatus({
        tone: "critical",
        text:
          error instanceof Error ? error.message : "Could not revoke admin.",
      });
    },
  });

  const isGranting = grantMutation.isPending;
  const revokingUserId = revokeMutation.isPending
    ? revokeMutation.variables
    : null;

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Flex direction="column" gap="xl">
          <Heading1>Admins</Heading1>
          <SmallBody>
            Grant or revoke admin access for any Bluesky account. Only
            hipstersmoothie.com can see this page.
          </SmallBody>
        </Flex>

        <Flex direction="column" gap="xl">
          <Flex style={styles.grantForm}>
            <div {...stylex.props(styles.grantField)}>
              <ComboBox
                aria-label="Bluesky handle"
                placeholder="handle.bsky.social"
                items={candidateUsers}
                inputValue={handleDraft}
                selectedKey={
                  candidateUsers.some((u) => u.handle === handleDraft)
                    ? handleDraft
                    : null
                }
                onInputChange={setHandleDraft}
                onSelectionChange={(key) => {
                  setHandleDraft(key === null ? "" : String(key));
                }}
                allowsCustomValue
                allowsEmptyCollection
              >
                {(user) => (
                  <ComboBoxItem
                    id={user.handle}
                    textValue={user.handle}
                    prefix={
                      <Avatar
                        src={user.image ?? undefined}
                        alt={user.handle}
                        fallback={user.handle[0]?.toUpperCase() ?? "?"}
                        size="sm"
                      />
                    }
                  >
                    <Flex direction="column" gap="xs">
                      <span {...stylex.props(styles.suggestionName)}>
                        {user.handle}
                      </span>
                      <SmallBody variant="secondary">{user.name}</SmallBody>
                    </Flex>
                  </ComboBoxItem>
                )}
              </ComboBox>
            </div>
            <Button
              isPending={isGranting}
              isDisabled={isGranting || handleDraft.trim().length === 0}
              onPress={() => {
                const trimmed = handleDraft.trim();
                if (!trimmed || isGranting) return;
                setStatus(null);
                grantMutation.mutate(trimmed);
              }}
            >
              Grant admin
            </Button>
          </Flex>
          {status ? (
            <div style={{ marginTop: 12 }}>
              <Text
                size="sm"
                variant={status.tone === "critical" ? "critical" : "secondary"}
              >
                {status.text}
              </Text>
            </div>
          ) : null}
        </Flex>

        <Card>
          <CardHeader>
            <CardTitle>Current admins ({admins.length})</CardTitle>
          </CardHeader>
          <CardBody>
            {admins.length === 0 ? (
              <Body>No admins yet.</Body>
            ) : (
              <Flex direction="column" style={styles.adminListStack}>
                {admins.map((admin) => {
                  const displayHandle = admin.handle ?? admin.did ?? admin.id;
                  const isBusy = revokingUserId === admin.id;
                  return (
                    <Flex key={admin.id} style={styles.adminRow}>
                      <Flex style={styles.adminIdentity}>
                        <Avatar
                          alt={admin.name}
                          src={admin.image ?? undefined}
                          size="lg"
                          fallback={admin.name.slice(0, 2).toUpperCase()}
                        />
                        <Flex direction="column" gap="xl">
                          <Text weight="semibold">
                            {admin.name}
                            {admin.isSuperAdmin ? " · super admin" : ""}
                          </Text>
                          <SmallBody variant="secondary">
                            {admin.handle ? `@${admin.handle}` : null}
                            {admin.handle && admin.did ? " · " : null}
                            {admin.did ?? (admin.handle ? null : displayHandle)}
                          </SmallBody>
                        </Flex>
                      </Flex>
                      {admin.isSuperAdmin ? (
                        <SmallBody variant="secondary">Cannot revoke</SmallBody>
                      ) : (
                        <Button
                          variant="secondary"
                          isPending={isBusy}
                          isDisabled={isBusy || revokeMutation.isPending}
                          onPress={() => {
                            setStatus(null);
                            revokeMutation.mutate(admin.id);
                          }}
                        >
                          Revoke
                        </Button>
                      )}
                    </Flex>
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
