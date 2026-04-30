import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  ExternalLink,
  MoreVertical,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { Card, CardBody } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { IconButton } from "../design-system/icon-button";
import { Menu, MenuItem } from "../design-system/menu";
import { Page } from "../design-system/page";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import {
  Body,
  Heading1,
  ListItem,
  UnorderedList,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { buildRouteOgMeta } from "../lib/og-meta";

const styles = stylex.create({
  header: {
    paddingBottom: verticalSpace["lg"],
  },
  grow: {
    flexGrow: 1,
    minWidth: 0,
  },
  page: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["8xl"],
    paddingTop: verticalSpace["4xl"],
    width: "100%",
  },
  section: {
    boxSizing: "border-box",
    maxWidth: "48rem",
    paddingBottom: verticalSpace["5xl"],
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace["5xl"],
    width: "100%",
  },
  listStack: {
    gap: gap.xl,
  },
  rowTop: {
    gap: gap.xl,
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
  },
  historyList: {
    gap: gap.sm,
    listStyleType: "disc",
    paddingLeft: horizontalSpace["2xl"],
  },
  icon: {
    borderRadius: "10px",
    flexShrink: 0,
    objectFit: "cover",
    height: "48px",
    width: "48px",
  },
  /** Inert trigger so `AlertDialog` can be opened only via `isOpen` (e.g. from the menu). */
  dialogTriggerPlaceholder: {
    margin: -1,
    padding: 0,
    borderWidth: 0,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    position: "absolute",
    whiteSpace: "nowrap",
    height: 1,
    width: 1,
  },
});

function statusBadgeVariant(status: string): "warning" | "critical" {
  if (status === "rejected") return "critical";
  return "warning";
}

function verificationLabel(status: string) {
  switch (status) {
    case "verified": {
      return "Live";
    }
    case "unverified": {
      return "Pending review";
    }
    case "rejected": {
      return "Rejected";
    }
    default: {
      return status;
    }
  }
}

function splitListingsByVerification<T extends { verificationStatus: string }>(
  rows: Array<T>,
): { live: Array<T>; pendingOrRejected: Array<T> } {
  const live: Array<T> = [];
  const pendingOrRejected: Array<T> = [];
  for (const row of rows) {
    if (row.verificationStatus === "verified") {
      live.push(row);
    } else {
      pendingOrRejected.push(row);
    }
  }
  return { live, pendingOrRejected };
}

export const Route = createFileRoute("/_header-layout/products/manage")({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user?.did) {
      throw redirect({
        to: "/login",
        search: { redirect: "/products/manage" },
      });
    }
    await context.queryClient.ensureQueryData(
      directoryListingApi.getMyProductListingsQueryOptions(),
    );
  },
  head: () =>
    buildRouteOgMeta({
      title: "Manage listings | at-store",
      description:
        "Create, edit, and track verification for your directory listings.",
    }),
  component: ManageListingsPage,
});

function ManageListingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: listings } = useSuspenseQuery(
    directoryListingApi.getMyProductListingsQueryOptions(),
  );

  const { live: liveListings, pendingOrRejected: pendingListings } = useMemo(
    () => splitListingsByVerification(listings),
    [listings],
  );

  const [deletingListingId, setDeletingListingId] = useState<string | null>(
    null,
  );
  const [listingPendingDelete, setListingPendingDelete] = useState<
    (typeof listings)[number] | null
  >(null);

  const deleteMutation = useMutation({
    mutationFn: async (listingId: string) => {
      await directoryListingApi.deleteOwnedProductListing({
        data: { listingId },
      });
    },
    onSuccess: async () => {
      setListingPendingDelete(null);
      await queryClient.invalidateQueries({
        queryKey:
          directoryListingApi.getMyProductListingsQueryOptions().queryKey,
      });
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    },
    onSettled: () => {
      setDeletingListingId(null);
    },
  });

  type MyListingRow = (typeof listings)[number];

  function renderListingCard(listing: MyListingRow) {
    const history = listing.rejectionHistory;
    const isLive = listing.verificationStatus === "verified";

    const actions = (
      <Menu
        placement="bottom end"
        trigger={
          <IconButton
            variant="secondary"
            size="lg"
            aria-label={`Listing actions for ${listing.name}`}
          >
            <MoreVertical size={22} aria-hidden />
          </IconButton>
        }
      >
        {isLive ? (
          <MenuItem
            prefix={<ExternalLink size={16} aria-hidden />}
            onPress={() => {
              void navigate({
                to: "/products/$productId",
                params: { productId: listing.slug },
              });
            }}
          >
            View listing
          </MenuItem>
        ) : null}
        <MenuItem
          prefix={<PencilLine size={16} aria-hidden />}
          onPress={() => {
            void navigate({
              to: "/products/$productId/edit",
              params: { productId: listing.slug },
              search: { from: "manage" },
            });
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          variant="destructive"
          prefix={<Trash2 size={16} aria-hidden />}
          onPress={() => {
            setListingPendingDelete(listing);
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    );

    if (isLive) {
      return (
        <Card key={listing.id} size="lg">
          <CardBody>
            <Flex direction="row" gap="xl" align="center" justify="between">
              <Flex direction="row" gap="xl" align="center">
                {listing.iconUrl ? (
                  <img
                    src={listing.iconUrl}
                    alt=""
                    {...stylex.props(styles.icon)}
                  />
                ) : null}
                <Text size="2xl" weight="semibold">
                  {listing.name}
                </Text>
              </Flex>
              {actions}
            </Flex>
          </CardBody>
        </Card>
      );
    }

    return (
      <Card key={listing.id} size="lg">
        <CardBody>
          <Flex direction="column" gap="6xl">
            <Flex style={styles.rowTop} gap="xl" align="start">
              <Flex gap="xl" align="center" style={styles.grow}>
                {listing.iconUrl ? (
                  <img
                    src={listing.iconUrl}
                    alt=""
                    {...stylex.props(styles.icon)}
                  />
                ) : null}
                <Flex
                  direction="row"
                  gap="xl"
                  align="center"
                  justify="between"
                  style={styles.grow}
                >
                  <Flex direction="column" gap="xl" style={styles.grow}>
                    <Text size="2xl" weight="semibold" style={styles.grow}>
                      {listing.name}
                    </Text>
                  </Flex>
                  <Badge
                    variant={statusBadgeVariant(listing.verificationStatus)}
                  >
                    {verificationLabel(listing.verificationStatus)}
                  </Badge>
                </Flex>
              </Flex>
              {actions}
            </Flex>

            {history.length > 0 ? (
              <Flex direction="column" gap="xl">
                <Text size="sm" weight="bold">
                  Rejection history
                </Text>
                <UnorderedList style={styles.historyList}>
                  {history.map((entry, hi) => (
                    <ListItem
                      key={`${listing.id}-rej-${hi}-${entry.createdAt}`}
                    >
                      <Text size="sm" variant="secondary">
                        {Intl.DateTimeFormat("en-US", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(entry.createdAt))}
                        {" — "}
                        {entry.reason}
                      </Text>
                    </ListItem>
                  ))}
                </UnorderedList>
              </Flex>
            ) : null}
          </Flex>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Page.Root variant="small" style={styles.page}>
        <Flex direction="column" gap="7xl" style={styles.section}>
          <Flex direction="column" gap="6xl" style={styles.header}>
            <Flex direction="row" gap="2xl" align="center" justify="between">
              <Heading1>Your listings</Heading1>
              <Button
                variant="primary"
                size="lg"
                onPress={() => {
                  void navigate({ to: "/products/create" });
                }}
              >
                <Flex align="center" gap="sm">
                  <Plus size={18} aria-hidden />
                  Create
                </Flex>
              </Button>
            </Flex>
            <Text size="lg" variant="secondary" leading="base">
              Create listings, track review status, and see feedback from
              moderation.
            </Text>
          </Flex>

          {listings.length === 0 ? (
            <Body variant="secondary">
              You don&rsquo;t have any listings yet. Create one to get started.
            </Body>
          ) : (
            <Flex direction="column" gap="6xl">
              {pendingListings.length > 0 ? (
                <Flex direction="column" gap="4xl">
                  <Flex direction="column" gap="4xl">
                    <Text size="xl" weight="semibold">
                      Pending
                    </Text>
                    <Text variant="secondary" leading="sm">
                      Not shown in the public directory until approved.
                      Rejection notes are kept so you can revise and resubmit.
                    </Text>
                  </Flex>
                  <Flex direction="column" style={styles.listStack}>
                    {pendingListings.map((listing) =>
                      renderListingCard(listing),
                    )}
                  </Flex>
                </Flex>
              ) : null}

              {liveListings.length > 0 ? (
                <Flex direction="column" gap="4xl">
                  <Text size="xl" weight="semibold">
                    Approved
                  </Text>
                  <Flex direction="column" style={styles.listStack}>
                    {liveListings.map((listing) => renderListingCard(listing))}
                  </Flex>
                </Flex>
              ) : null}
            </Flex>
          )}
        </Flex>
      </Page.Root>

      <AlertDialog
        isOpen={listingPendingDelete != null}
        onOpenChange={(open) => {
          if (!open) {
            setListingPendingDelete(null);
          }
        }}
        trigger={
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            {...stylex.props(styles.dialogTriggerPlaceholder)}
          />
        }
      >
        <AlertDialogHeader>Delete listing?</AlertDialogHeader>
        <AlertDialogDescription>
          Permanently delete &ldquo;{listingPendingDelete?.name ?? ""}&rdquo;
          from your PDS and the directory mirror. This cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancelButton />
          <AlertDialogActionButton
            variant="critical"
            closeOnPress={false}
            isPending={
              listingPendingDelete != null &&
              deletingListingId === listingPendingDelete.id &&
              deleteMutation.isPending
            }
            onPress={() => {
              if (!listingPendingDelete) return;
              setDeletingListingId(listingPendingDelete.id);
              deleteMutation.mutate(listingPendingDelete.id);
            }}
          >
            Delete listing
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
