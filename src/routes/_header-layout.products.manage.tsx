import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  ArrowRightLeft,
  BadgeCheck,
  ExternalLink,
  MoreHorizontal,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link as AriaLink } from "react-aria-components";

import { StatusPill } from "../components/shelf/account/StatusPill";
import { formatTimeAgo } from "../components/shelf/format";
import { ListingIcon } from "../components/shelf/ListingIcon";
import { ListingRating } from "../components/shelf/ListingRating";
import {
  PageHero,
  SectionHeader,
  ShelfSection,
} from "../components/shelf/Section";
import { TransferListingDialog } from "../components/TransferListingDialog";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Button } from "../design-system/button";
import { IconButton } from "../design-system/icon-button";
import { Menu, MenuItem, MenuSeparator } from "../design-system/menu";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { useButtonStyles } from "../design-system/theme/useButtonStyles";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { buildRouteOgMeta } from "../lib/og-meta";

const ButtonLink = createLink(Button);
const AriaRouterLink = createLink(AriaLink);

const styles = stylex.create({
  page: {
    fontFamily: fontFamily.sans,
    paddingBottom: { default: 56, [breakpoints.md]: 88 },
  },
  sectionCount: {
    color: uiColor.text1,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.medium,
    marginLeft: 8,
  },
  table: {
    borderTopColor: uiColor.border2,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  row: {
    paddingBlock: 16,
    alignItems: "center",
    columnGap: { default: 14, [breakpoints.md]: 20 },
    display: "grid",
    gridTemplateColumns: {
      default: "auto minmax(0, 1fr) auto",
      [breakpoints.md]: "auto minmax(0, 1fr) 120px auto",
      [breakpoints.lg]: "auto minmax(0, 1fr) 140px 110px 80px auto",
    },
    rowGap: 12,
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  pendingRow: {
    gridTemplateColumns: {
      default: "auto minmax(0, 1fr) auto",
      [breakpoints.md]: "auto minmax(0, 1fr) 110px 150px auto",
    },
  },
  nameCell: {
    minWidth: 0,
  },
  name: {
    overflow: "hidden",
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
    color: uiColor.text2,
    display: "block",
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.006em",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  nameText: {
    overflow: "hidden",
    color: uiColor.text2,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.006em",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tagline: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 14,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
  },
  stat: {
    columnGap: 2,
    display: "flex",
    flexDirection: "column",
    fontSize: 14,
    rowGap: 2,
    minWidth: 0,
  },
  statReviews: {
    display: { default: "none", [breakpoints.md]: "flex" },
  },
  statUpdated: {
    display: { default: "none", [breakpoints.lg]: "flex" },
  },
  statUpdatedPending: {
    display: { default: "none", [breakpoints.md]: "flex" },
  },
  statLabel: {
    color: uiColor.text1,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  statValue: {
    color: uiColor.text2,
    whiteSpace: "nowrap",
  },
  muted: {
    color: uiColor.text1,
  },
  statusCell: {
    display: { default: "none", [breakpoints.lg]: "block" },
  },
  pendingStatusCell: {
    display: { default: "none", [breakpoints.md]: "block" },
  },
  actions: {
    alignItems: "center",
    columnGap: 6,
    display: "flex",
    justifyContent: "flex-end",
    rowGap: 6,
  },
  wideOnly: {
    display: { default: "none", [breakpoints.sm]: "inline-flex" },
  },
  history: {
    borderRadius: 14,
    paddingBlock: 12,
    paddingInline: 16,
    backgroundColor: uiColor.component1,
    fontSize: 14,
    gridColumnEnd: "-1",
    gridColumnStart: "1",
  },
  historyTitle: {
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
    marginBottom: 6,
  },
  historyList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    columnGap: 4,
    display: "flex",
    flexDirection: "column",
    rowGap: 4,
  },
  historyItem: {
    color: uiColor.text1,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  historyDate: {
    color: uiColor.text2,
    fontVariantNumeric: "tabular-nums",
    marginRight: 8,
  },
  transferNote: {
    color: uiColor.text1,
    fontSize: 13,
    marginTop: 4,
  },
  mobileStatus: {
    display: { default: "block", [breakpoints.md]: "none" },
    marginTop: 6,
  },
  mobileStatusLive: {
    display: { default: "block", [breakpoints.lg]: "none" },
    marginTop: 6,
  },
  empty: {
    padding: 28,
    borderColor: uiColor.border2,
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    alignItems: { default: "flex-start", [breakpoints.sm]: "center" },
    color: uiColor.text1,
    columnGap: 16,
    display: "flex",
    flexDirection: { default: "column", [breakpoints.sm]: "row" },
    justifyContent: "space-between",
    rowGap: 16,
  },
  callout: {
    borderColor: uiColor.border1,
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: 20,
    paddingInline: { default: 20, [breakpoints.md]: 24 },
    alignItems: { default: "flex-start", [breakpoints.sm]: "center" },
    backgroundColor: uiColor.bg,
    columnGap: 16,
    display: "flex",
    flexDirection: { default: "column", [breakpoints.sm]: "row" },
    rowGap: 16,
  },
  calloutIcon: {
    color: uiColor.text2,
    flexShrink: 0,
  },
  calloutBody: {
    flexGrow: 1,
    minWidth: 0,
  },
  calloutTitle: {
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
  },
  calloutText: {
    color: uiColor.text1,
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 0,
    marginTop: 2,
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

const historyDateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
});

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
  const secondaryButton = useButtonStyles({ variant: "secondary", size: "sm" });

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
  /** Id, not the row: the dialog should reflect the refetched row after an offer. */
  const [transferListingId, setTransferListingId] = useState<string | null>(
    null,
  );
  const transferListing =
    listings.find((listing) => listing.id === transferListingId) ?? null;

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

  function renderActionsMenu(listing: MyListingRow) {
    const isLive = listing.verificationStatus === "verified";
    return (
      <Menu
        placement="bottom end"
        trigger={
          <IconButton
            variant="secondary"
            size="sm"
            aria-label={`Listing actions for ${listing.name}`}
          >
            <MoreHorizontal size={16} aria-hidden />
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
        {listing.canTransfer ? (
          <MenuItem
            prefix={<ArrowRightLeft size={16} aria-hidden />}
            onPress={() => {
              setTransferListingId(listing.id);
            }}
          >
            {listing.pendingTransfer
              ? "Pending transfer"
              : "Transfer ownership"}
          </MenuItem>
        ) : null}
        <MenuSeparator />
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
  }

  function renderTransferNote(listing: MyListingRow) {
    const pending = listing.pendingTransfer;
    if (!pending) return null;
    return (
      <div {...stylex.props(styles.transferNote)}>
        Transfer to {pending.handle ? `@${pending.handle}` : pending.did}{" "}
        pending
      </div>
    );
  }

  function renderEditButton(listing: MyListingRow) {
    return (
      <AriaRouterLink
        to="/products/$productId/edit"
        params={{ productId: listing.slug }}
        search={{ from: "manage" }}
        aria-label={`Edit ${listing.name}`}
        {...stylex.props(secondaryButton, styles.wideOnly)}
      >
        <PencilLine size={14} aria-hidden />
        Edit
      </AriaRouterLink>
    );
  }

  function renderLiveRow(listing: MyListingRow) {
    return (
      <div key={listing.id} {...stylex.props(styles.row)}>
        <ListingIcon name={listing.name} src={listing.iconUrl} size={48} />
        <div {...stylex.props(styles.nameCell)}>
          <RouterLink
            to="/products/$productId"
            params={{ productId: listing.slug }}
            {...stylex.props(styles.name)}
          >
            {listing.name}
          </RouterLink>
          {listing.tagline ? (
            <div {...stylex.props(styles.tagline)}>{listing.tagline}</div>
          ) : null}
          {renderTransferNote(listing)}
          <div {...stylex.props(styles.mobileStatusLive)}>
            <StatusPill status={listing.verificationStatus} />
          </div>
        </div>
        <div {...stylex.props(styles.stat, styles.statReviews)}>
          <span {...stylex.props(styles.statLabel)}>Reviews</span>
          <span {...stylex.props(styles.statValue)}>
            {listing.reviewCount > 0 ? (
              <ListingRating
                rating={listing.averageRating}
                reviewCount={listing.reviewCount}
                showCount
              />
            ) : (
              <span {...stylex.props(styles.muted)}>None yet</span>
            )}
          </span>
        </div>
        <div {...stylex.props(styles.stat, styles.statUpdated)}>
          <span {...stylex.props(styles.statLabel)}>Updated</span>
          <span {...stylex.props(styles.statValue)}>
            {formatTimeAgo(listing.updatedAt)}
          </span>
        </div>
        <div {...stylex.props(styles.statusCell)}>
          <StatusPill status={listing.verificationStatus} />
        </div>
        <div {...stylex.props(styles.actions)}>
          {renderEditButton(listing)}
          <AriaRouterLink
            to="/products/$productId"
            params={{ productId: listing.slug }}
            aria-label={`View ${listing.name}`}
            {...stylex.props(secondaryButton, styles.wideOnly)}
          >
            View
          </AriaRouterLink>
          {renderActionsMenu(listing)}
        </div>
      </div>
    );
  }

  function renderPendingRow(listing: MyListingRow) {
    const history = listing.rejectionHistory;
    return (
      <div key={listing.id} {...stylex.props(styles.row, styles.pendingRow)}>
        <ListingIcon name={listing.name} src={listing.iconUrl} size={48} />
        <div {...stylex.props(styles.nameCell)}>
          <div {...stylex.props(styles.nameText)}>{listing.name}</div>
          {renderTransferNote(listing)}
          <div {...stylex.props(styles.mobileStatus)}>
            <StatusPill status={listing.verificationStatus} />
          </div>
        </div>
        <div {...stylex.props(styles.stat, styles.statUpdatedPending)}>
          <span {...stylex.props(styles.statLabel)}>Updated</span>
          <span {...stylex.props(styles.statValue)}>
            {formatTimeAgo(listing.updatedAt)}
          </span>
        </div>
        <div {...stylex.props(styles.pendingStatusCell)}>
          <StatusPill status={listing.verificationStatus} />
        </div>
        <div {...stylex.props(styles.actions)}>
          {renderEditButton(listing)}
          {renderActionsMenu(listing)}
        </div>
        {history.length > 0 ? (
          <div {...stylex.props(styles.history)}>
            <div {...stylex.props(styles.historyTitle)}>Rejection history</div>
            <ul {...stylex.props(styles.historyList)}>
              {history.map((entry, hi) => (
                <li
                  key={`${listing.id}-rej-${hi}-${entry.createdAt}`}
                  {...stylex.props(styles.historyItem)}
                >
                  <span {...stylex.props(styles.historyDate)}>
                    {historyDateFormat.format(new Date(entry.createdAt))}
                  </span>
                  {entry.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div {...stylex.props(styles.page)}>
        <PageHero
          title="Your listings"
          description="Create listings, track review status, and see feedback from moderation."
          aside={
            <ButtonLink to="/products/create" variant="primary" size="lg">
              <Plus size={16} aria-hidden />
              Submit an app
            </ButtonLink>
          }
        />

        {listings.length === 0 ? (
          <ShelfSection flush>
            <div {...stylex.props(styles.empty)}>
              <span>
                Nothing is published from your repository yet. Create a listing
                to get started.
              </span>
              <ButtonLink to="/products/create" variant="secondary" size="md">
                <Plus size={15} aria-hidden />
                Submit an app
              </ButtonLink>
            </div>
          </ShelfSection>
        ) : (
          <>
            <ShelfSection flush>
              <SectionHeader
                title="Pending review"
                description="Not shown in the public directory until approved. Rejection notes are kept so you can revise and resubmit."
              />
              {pendingListings.length > 0 ? (
                <div {...stylex.props(styles.table)}>
                  {pendingListings.map((listing) => renderPendingRow(listing))}
                </div>
              ) : (
                <div {...stylex.props(styles.empty)}>
                  Nothing waiting for review.
                </div>
              )}
            </ShelfSection>

            {liveListings.length > 0 ? (
              <ShelfSection>
                <SectionHeader
                  title={
                    <>
                      Live
                      <span {...stylex.props(styles.sectionCount)}>
                        {liveListings.length}
                      </span>
                    </>
                  }
                />
                <div {...stylex.props(styles.table)}>
                  {liveListings.map((listing) => renderLiveRow(listing))}
                </div>
              </ShelfSection>
            ) : null}
          </>
        )}

        <ShelfSection>
          <div {...stylex.props(styles.callout)}>
            <BadgeCheck
              size={22}
              aria-hidden
              {...stylex.props(styles.calloutIcon)}
            />
            <div {...stylex.props(styles.calloutBody)}>
              <div {...stylex.props(styles.calloutTitle)}>
                Already listed by at-store?
              </div>
              <p {...stylex.props(styles.calloutText)}>
                If we added your app before you did, claim it to move the record
                into your own repo. To move a listing you already own to another
                account, use &ldquo;Transfer ownership&rdquo; in its menu.
              </p>
            </div>
            <ButtonLink to="/product/claim" variant="secondary" size="md">
              Claim a listing
            </ButtonLink>
          </div>
        </ShelfSection>
      </div>

      <TransferListingDialog
        listing={transferListing}
        onOpenChange={(open) => {
          if (!open) {
            setTransferListingId(null);
          }
        }}
      />

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
