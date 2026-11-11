import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as TanstackLink, createLink } from "@tanstack/react-router";
import {
  ChevronDown,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Share,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  Button as AriaDisclosureTriggerButton,
  Disclosure,
  DisclosurePanel,
} from "react-aria-components";

import type {
  DirectoryListingReview,
  DirectoryListingReviewReply,
  DirectoryUserReviewListing,
} from "../integrations/tanstack-query/api-directory-listings.functions";

import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Form } from "../design-system/form";
import { IconButton } from "../design-system/icon-button";
import { Menu, MenuItem } from "../design-system/menu";
import { StarRating } from "../design-system/star-rating";
import { TextArea } from "../design-system/text-area";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontWeight } from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { blueskyReviewShareIntentHref } from "../lib/bluesky-review-share";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { RestrictedMarkdownContent } from "./restricted-markdown-content";
import { formatReviewDate } from "./shelf/listing/listing-helpers";
import { ListingIcon } from "./shelf/ListingIcon";

const IconButtonLink = createLink(IconButton);

const fullDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatFullDate(iso: string) {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "" : fullDate.format(time);
}

const styles = stylex.create({
  /** Default: a flat row between hairlines, for review lists. */
  row: {
    paddingBlock: 22,
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    scrollMarginTop: 96,
  },
  /** With `reviewedListing`: a standalone card (profile grids). */
  card: {
    padding: 20,
    borderColor: uiColor.border1,
    borderRadius: 18,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
    minWidth: 0,
    scrollMarginTop: 96,
  },
  forLink: {
    textDecoration: "none",
    alignItems: "center",
    color: "inherit",
    columnGap: 12,
    display: "flex",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    borderBottomColor: uiColor.border1,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    marginBottom: 14,
    minWidth: 0,
    paddingBottom: 14,
  },
  forText: {
    display: "flex",
    flexDirection: "column",
    fontSize: 14,
    minWidth: 0,
  },
  forName: {
    color: {
      default: uiColor.text2,
      ":hover": uiColor.text1,
    },
    fontWeight: fontWeight.semibold,
  },
  forTagline: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 13,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  who: {
    alignItems: "center",
    columnGap: 12,
    display: "flex",
    minWidth: 0,
  },
  whoText: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 0,
  },
  avatar: {
    borderRadius: "50%",
    flexShrink: 0,
    height: 38,
    width: 38,
  },
  avatarSmall: {
    borderRadius: "50%",
    flexShrink: 0,
    height: 28,
    width: 28,
  },
  avatarLink: {
    borderRadius: "50%",
    display: "block",
    flexShrink: 0,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
  },
  name: {
    overflow: "hidden",
    textDecoration: "none",
    color: uiColor.text2,
    display: "block",
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    textDecorationLine: { default: "none", ":hover": "underline" },
    textOverflow: "ellipsis",
    textUnderlineOffset: 3,
    whiteSpace: "nowrap",
  },
  sub: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 13,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 1,
  },
  right: {
    alignItems: "center",
    columnGap: 2,
    display: "flex",
    flexShrink: 0,
    marginLeft: "auto",
  },
  stars: {
    marginRight: 6,
  },
  ghostIcon: {
    color: uiColor.text1,
  },
  text: {
    marginTop: 12,
  },
  paragraph: {
    color: uiColor.text2,
    fontSize: { default: 15, [breakpoints.md]: 16 },
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  thread: {
    display: "flex",
    flexDirection: "column",
    rowGap: 12,
    marginTop: 12,
  },
  repliesToggle: {
    borderRadius: 999,
    borderWidth: 0,
    paddingBlock: 5,
    paddingInline: 12,
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: {
      default: uiColor.component1,
      ":is([data-hovered])": uiColor.component2,
    },
    color: uiColor.text2,
    columnGap: 6,
    cursor: "pointer",
    display: "inline-flex",
    fontSize: 13,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: {
      default: "none",
      ":is([data-focus-visible])": "solid",
    },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "background-color",
  },
  chevron: {
    transform: {
      default: null,
      ":is([data-expanded] *)": "rotate(180deg)",
    },
    transitionDuration: animationDuration.default,
    transitionProperty: "transform",
  },
  repliesPanel: {
    display: "flex",
    flexDirection: "column",
    rowGap: 12,
    paddingTop: 12,
  },
  rail: {
    display: "flex",
    flexDirection: "column",
    rowGap: 16,
    borderLeftColor: uiColor.border1,
    borderLeftStyle: "solid",
    borderLeftWidth: 2,
    marginLeft: 6,
    paddingLeft: 16,
  },
  reply: {
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
    scrollMarginTop: 96,
  },
  replyHeader: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    minWidth: 0,
  },
  replyText: {
    paddingLeft: 38,
  },
  replyParagraph: {
    color: uiColor.text2,
    fontSize: 15,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  },
  replyEdit: {
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
    paddingLeft: 38,
  },
  replyEditActions: {
    columnGap: 8,
    display: "flex",
  },
  composer: {
    display: "flex",
    flexDirection: "column",
    rowGap: 6,
  },
  composerButton: {
    marginTop: 4,
  },
  muted: {
    color: uiColor.text1,
    fontSize: 13,
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

export type DirectoryListingReviewCardProps = {
  review: DirectoryListingReview;
  /** Store listing UUID — used to invalidate review queries after delete. */
  listingId: string;
  /** When set and equal to `review.authorDid`, shows the overflow menu for edit/delete. */
  viewerDid?: string | null;
  onEditReview?: () => void;
  /** Forwarded to the outer element for layout contexts (e.g. grids). */
  style?: stylex.StyleXStyles;
  /** When true (default), avatar and name link to the reviewer profile. */
  linkAuthorProfile?: boolean;
  /** When set, the card highlights the listing being reviewed (e.g. profile page). */
  reviewedListing?: DirectoryUserReviewListing;
  /** Anchor for scroll/deep links (`?review=`). */
  anchorId?: string;
  /** Canonical product slug — enables “Share” (Bluesky) for this review. */
  shareProductSlug?: string | null;
  /** Listing publisher DIDs — Reply button is UI-gated to listing side on an empty thread. */
  listingRepoDid?: string | null;
  listingProductAccountDid?: string | null;
};

function authorLabelFor(review: DirectoryListingReview) {
  return (
    review.authorDisplayName?.trim() ||
    (review.authorDid.length > 16
      ? `${review.authorDid.slice(0, 10)}…`
      : review.authorDid)
  );
}

function replyHandleLabel(handle: string | null | undefined): string | null {
  const trimmed = handle?.trim();
  if (!trimmed) return null;
  const withoutAt = trimmed.replace(/^@+/, "");
  return withoutAt.length > 0 ? `@${withoutAt}` : null;
}

function authorLabelForReply(reply: DirectoryListingReviewReply): string {
  return (
    reply.authorDisplayName?.trim() ||
    (reply.authorDid.length > 16
      ? `${reply.authorDid.slice(0, 10)}…`
      : reply.authorDid)
  );
}

/** UI-only: listing side can open the thread with Reply; reviewers wait until at least one reply exists. */
function replyComposerShownUi(opts: {
  apiCanReply: boolean;
  viewerDid?: string | null;
  reviewAuthorDid: string;
  replyCount: number;
  listingRepoDid?: string | null;
  listingProductAccountDid?: string | null;
}) {
  if (!opts.apiCanReply) return false;
  const v = opts.viewerDid?.trim();
  if (!v) return false;

  const listingRepo = opts.listingRepoDid?.trim();
  const listingProd = opts.listingProductAccountDid?.trim();
  const viewerIsListingSide =
    (!!listingRepo && v === listingRepo) ||
    (!!listingProd && v === listingProd);
  if (viewerIsListingSide) return true;

  const isReviewAuthor = v === opts.reviewAuthorDid.trim();
  if (isReviewAuthor && opts.replyCount === 0) return false;

  return true;
}

function ReviewConversationSection({
  listingId,
  review,
  viewerDid,
  linkAuthorProfile,
  showReplyComposer,
}: {
  listingId: string;
  review: DirectoryListingReview;
  viewerDid?: string | null;
  linkAuthorProfile: boolean;
  showReplyComposer: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteReplyId, setDeleteReplyId] = useState<string | null>(null);

  const repliesQuery = useQuery(
    directoryListingApi.getDirectoryListingReviewRepliesQueryOptions(review.id),
  );

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey:
          directoryListingApi.getDirectoryListingReviewRepliesQueryOptions(
            review.id,
          ).queryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey:
          directoryListingApi.getDirectoryListingReviewsQueryOptions(listingId)
            .queryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey:
          directoryListingApi.getDirectoryListingDetailQueryOptions(listingId)
            .queryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: ["userProfileReviews"],
      }),
    ]);
  }

  const createReply = useMutation({
    mutationFn: () =>
      directoryListingApi.createDirectoryListingReviewReply({
        data: { reviewId: review.id, text: draft.trim() },
      }),
    onSuccess: async () => {
      setDraft("");
      setFormError(null);
      await invalidateAll();
    },
    onError: (e: unknown) => {
      setFormError(
        e instanceof Error ? e.message : "Could not post your reply.",
      );
    },
  });

  const updateReply = useMutation({
    mutationFn: ({ replyId, text }: { replyId: string; text: string }) =>
      directoryListingApi.updateDirectoryListingReviewReply({
        data: { replyId, text },
      }),
    onSuccess: async () => {
      setEditingReplyId(null);
      setEditDraft("");
      await invalidateAll();
    },
    onError: (e: unknown) => {
      setFormError(
        e instanceof Error ? e.message : "Could not update your reply.",
      );
    },
  });

  const deleteReply = useMutation({
    mutationFn: (replyId: string) =>
      directoryListingApi.deleteDirectoryListingReviewReply({
        data: { replyId },
      }),
    onSuccess: async () => {
      setDeleteReplyId(null);
      await invalidateAll();
    },
  });

  const replies = repliesQuery.data ?? [];

  const isReplyAuthor = (did: string) =>
    viewerDid != null && viewerDid !== "" && viewerDid.trim() === did.trim();

  const replyHeadingLabel =
    review.replyCount === 1 ? "1 reply" : `${review.replyCount} replies`;

  const composer = showReplyComposer ? (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = draft.trim();
        if (trimmed.length === 0) return;
        setFormError(null);
        createReply.mutate();
      }}
    >
      <div {...stylex.props(styles.composer)}>
        <TextArea
          aria-label="Write a reply"
          size="lg"
          autosize={true}
          isResizable={false}
          value={draft}
          placeholder="Write a reply..."
          variant="secondary"
          onChange={setDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              e.preventDefault();
              if (draft.trim().length === 0) return;
              setFormError(null);
              createReply.mutate();
            }
          }}
          suffix={
            <Button
              type="submit"
              variant="tertiary"
              size="sm"
              isDisabled={draft.trim().length === 0}
              isPending={createReply.isPending}
              style={styles.composerButton}
            >
              Reply
            </Button>
          }
        />
        {formError ? (
          <span {...stylex.props(styles.muted)}>{formError}</span>
        ) : null}
      </div>
    </Form>
  ) : null;

  return (
    <>
      <div {...stylex.props(styles.thread)}>
        {review.replyCount > 0 ? (
          <Disclosure>
            <AriaDisclosureTriggerButton
              slot="trigger"
              {...stylex.props(styles.repliesToggle)}
            >
              <MessageCircle size={14} aria-hidden />
              {replyHeadingLabel}
              <ChevronDown
                size={14}
                aria-hidden
                {...stylex.props(styles.chevron)}
              />
            </AriaDisclosureTriggerButton>
            <DisclosurePanel>
              <div {...stylex.props(styles.repliesPanel)}>
                <div {...stylex.props(styles.rail)}>
                  {repliesQuery.isPending ? (
                    <span {...stylex.props(styles.muted)}>
                      Loading replies…
                    </span>
                  ) : (
                    replies.map((reply) => (
                      <ReplyItem
                        key={reply.id}
                        reply={reply}
                        linkAuthorProfile={linkAuthorProfile}
                        canManage={isReplyAuthor(reply.authorDid)}
                        isEditing={editingReplyId === reply.id}
                        editDraft={editDraft}
                        onEditDraftChange={setEditDraft}
                        formError={
                          editingReplyId === reply.id ? formError : null
                        }
                        isSaving={updateReply.isPending}
                        onStartEdit={() => {
                          setEditingReplyId(reply.id);
                          setEditDraft(reply.text);
                        }}
                        onCancelEdit={() => {
                          setEditingReplyId(null);
                          setEditDraft("");
                          setFormError(null);
                        }}
                        onSaveEdit={() => {
                          const trimmed = editDraft.trim();
                          if (trimmed.length === 0) return;
                          setFormError(null);
                          updateReply.mutate({
                            replyId: reply.id,
                            text: trimmed,
                          });
                        }}
                        onDelete={() => setDeleteReplyId(reply.id)}
                      />
                    ))
                  )}
                </div>
                {composer}
              </div>
            </DisclosurePanel>
          </Disclosure>
        ) : (
          composer
        )}
      </div>

      <AlertDialog
        isOpen={deleteReplyId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteReplyId(null);
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
        <AlertDialogHeader>Delete this reply?</AlertDialogHeader>
        <AlertDialogDescription>
          This removes your reply from this review thread.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancelButton />
          <AlertDialogActionButton
            variant="critical"
            closeOnPress={false}
            isPending={deleteReply.isPending}
            onPress={() => {
              if (deleteReplyId != null) deleteReply.mutate(deleteReplyId);
            }}
          >
            Delete reply
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}

function ReplyItem({
  reply,
  linkAuthorProfile,
  canManage,
  isEditing,
  editDraft,
  onEditDraftChange,
  formError,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  reply: DirectoryListingReviewReply;
  linkAuthorProfile: boolean;
  canManage: boolean;
  isEditing: boolean;
  editDraft: string;
  onEditDraftChange: (value: string) => void;
  formError: string | null;
  isSaving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}) {
  const label = authorLabelForReply(reply);
  const handle = replyHandleLabel(reply.authorHandle);
  const avatar = (
    <Avatar
      alt={handle ? `${label} (${handle})` : label}
      fallback={getInitials(label)}
      src={reply.authorAvatarUrl || undefined}
      style={styles.avatarSmall}
    />
  );

  return (
    <div
      id={`listing-review-reply-${reply.id}`}
      {...stylex.props(styles.reply)}
    >
      <div {...stylex.props(styles.replyHeader)}>
        {linkAuthorProfile ? (
          <TanstackLink
            to="/profile/$actor"
            params={{ actor: reply.authorDid }}
            aria-hidden
            tabIndex={-1}
            {...stylex.props(styles.avatarLink)}
          >
            {avatar}
          </TanstackLink>
        ) : (
          avatar
        )}
        <div {...stylex.props(styles.whoText)}>
          {linkAuthorProfile ? (
            <TanstackLink
              to="/profile/$actor"
              params={{ actor: reply.authorDid }}
              {...stylex.props(styles.name)}
            >
              {label}
            </TanstackLink>
          ) : (
            <span {...stylex.props(styles.name)}>{label}</span>
          )}
          <div {...stylex.props(styles.sub)}>
            {handle ? `${handle} · ` : ""}
            <time
              dateTime={reply.replyCreatedAt}
              title={formatFullDate(reply.replyCreatedAt)}
            >
              {formatReviewDate(reply.replyCreatedAt)}
            </time>
          </div>
        </div>
        {canManage ? (
          <Menu
            placement="bottom end"
            trigger={
              <IconButton
                aria-label="Reply actions"
                variant="tertiary"
                size="sm"
                style={styles.ghostIcon}
              >
                <MoreHorizontal size={16} />
              </IconButton>
            }
          >
            <MenuItem prefix={<Pencil size={16} />} onPress={onStartEdit}>
              Edit reply
            </MenuItem>
            <MenuItem
              variant="destructive"
              prefix={<Trash2 size={16} />}
              onPress={onDelete}
            >
              Delete reply
            </MenuItem>
          </Menu>
        ) : null}
      </div>
      {isEditing ? (
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveEdit();
          }}
        >
          <div {...stylex.props(styles.replyEdit)}>
            <TextArea
              aria-label="Edit reply"
              value={editDraft}
              rows={4}
              onChange={onEditDraftChange}
              size="lg"
            />
            {formError ? (
              <span {...stylex.props(styles.muted)}>{formError}</span>
            ) : null}
            <div {...stylex.props(styles.replyEditActions)}>
              <Button
                size="sm"
                type="submit"
                variant="primary"
                isPending={isSaving}
              >
                Save
              </Button>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onPress={onCancelEdit}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Form>
      ) : (
        <RestrictedMarkdownContent
          content={reply.text}
          style={styles.replyText}
          paragraphStyle={styles.replyParagraph}
        />
      )}
    </div>
  );
}

export function DirectoryListingReviewCard({
  review,
  listingId,
  viewerDid,
  onEditReview,
  style,
  linkAuthorProfile = true,
  reviewedListing,
  anchorId,
  shareProductSlug,
  listingRepoDid,
  listingProductAccountDid,
}: DirectoryListingReviewCardProps) {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const mergedListingRepoDid =
    listingRepoDid ?? reviewedListing?.repoDid ?? null;
  const mergedListingProductAccountDid =
    listingProductAccountDid ?? reviewedListing?.productAccountDid ?? null;

  const showReplyComposer = replyComposerShownUi({
    apiCanReply: review.canReply,
    viewerDid,
    reviewAuthorDid: review.authorDid,
    replyCount: review.replyCount,
    listingRepoDid: mergedListingRepoDid,
    listingProductAccountDid: mergedListingProductAccountDid,
  });
  const showReplyThreadChrome = review.replyCount > 0 || showReplyComposer;

  const authorLabel = authorLabelFor(review);
  const reviewerHandle = replyHandleLabel(review.authorHandle);
  const isAuthor =
    viewerDid != null && viewerDid !== "" && viewerDid === review.authorDid;
  const listingProductId = reviewedListing
    ? getDirectoryListingSlug(reviewedListing)
    : null;
  const showsListing = Boolean(reviewedListing && listingProductId);

  const deleteReview = useMutation({
    mutationFn: () =>
      directoryListingApi.deleteDirectoryListingReview({
        data: { reviewId: review.id },
      }),
    onSuccess: async () => {
      setDeleteDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            directoryListingApi.getDirectoryListingReviewsQueryOptions(
              listingId,
            ).queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey:
            directoryListingApi.getDirectoryListingDetailQueryOptions(listingId)
              .queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey:
            directoryListingApi.getUserProfileReviewsPageDataQueryOptions(
              review.authorDid,
            ).queryKey,
          exact: true,
        }),
      ]);
    },
  });

  const avatar = (
    <Avatar
      alt={reviewerHandle ? `${authorLabel} (${reviewerHandle})` : authorLabel}
      fallback={getInitials(authorLabel)}
      src={review.authorAvatarUrl || undefined}
      style={styles.avatar}
    />
  );

  const date = (
    <time
      dateTime={review.reviewCreatedAt}
      title={formatFullDate(review.reviewCreatedAt)}
    >
      {formatReviewDate(review.reviewCreatedAt)}
    </time>
  );

  return (
    <>
      <article
        id={anchorId}
        {...stylex.props(showsListing ? styles.card : styles.row, style)}
      >
        {reviewedListing && listingProductId ? (
          <TanstackLink
            to="/products/$productId"
            params={{ productId: listingProductId }}
            {...stylex.props(styles.forLink)}
          >
            <ListingIcon
              name={reviewedListing.name}
              src={reviewedListing.iconUrl}
              size={36}
            />
            <span {...stylex.props(styles.forText)}>
              <span {...stylex.props(styles.forName)}>
                {reviewedListing.name}
              </span>
              {reviewedListing.tagline ? (
                <span {...stylex.props(styles.forTagline)}>
                  {reviewedListing.tagline}
                </span>
              ) : null}
            </span>
          </TanstackLink>
        ) : null}

        <div {...stylex.props(styles.who)}>
          {showsListing ? null : linkAuthorProfile ? (
            <TanstackLink
              to="/profile/$actor"
              params={{ actor: review.authorDid }}
              aria-hidden
              tabIndex={-1}
              {...stylex.props(styles.avatarLink)}
            >
              {avatar}
            </TanstackLink>
          ) : (
            avatar
          )}
          <div {...stylex.props(styles.whoText)}>
            {showsListing ? null : linkAuthorProfile ? (
              <TanstackLink
                to="/profile/$actor"
                params={{ actor: review.authorDid }}
                {...stylex.props(styles.name)}
              >
                {authorLabel}
              </TanstackLink>
            ) : (
              <span {...stylex.props(styles.name)}>{authorLabel}</span>
            )}
            <div {...stylex.props(styles.sub)}>
              {!showsListing && reviewerHandle ? `${reviewerHandle} · ` : ""}
              {date}
            </div>
          </div>
          <div {...stylex.props(styles.right)}>
            <StarRating
              rating={review.rating}
              showReviewCount={false}
              size={13}
              aria-label={`${String(review.rating)} out of 5 stars`}
              role="img"
              style={styles.stars}
            />
            {shareProductSlug ? (
              <IconButtonLink
                to={blueskyReviewShareIntentHref(shareProductSlug, review.id)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share review on Bluesky"
                variant="tertiary"
                size="sm"
                style={styles.ghostIcon}
              >
                <Share size={15} />
              </IconButtonLink>
            ) : null}
            {isAuthor ? (
              <Menu
                placement="bottom end"
                trigger={
                  <IconButton
                    aria-label="Review actions"
                    variant="tertiary"
                    size="sm"
                    style={styles.ghostIcon}
                  >
                    <MoreHorizontal size={16} />
                  </IconButton>
                }
              >
                <MenuItem
                  onPress={() => onEditReview?.()}
                  isDisabled={onEditReview == null}
                  prefix={<Pencil size={16} />}
                >
                  Edit review
                </MenuItem>
                <MenuItem
                  variant="destructive"
                  onPress={() => setDeleteDialogOpen(true)}
                  prefix={<Trash2 size={16} />}
                >
                  Delete review
                </MenuItem>
              </Menu>
            ) : null}
          </div>
        </div>

        {review.text ? (
          <RestrictedMarkdownContent
            content={review.text}
            style={styles.text}
            paragraphStyle={styles.paragraph}
          />
        ) : null}

        {showReplyThreadChrome ? (
          <ReviewConversationSection
            listingId={listingId}
            linkAuthorProfile={linkAuthorProfile}
            review={review}
            showReplyComposer={showReplyComposer}
            viewerDid={viewerDid ?? null}
          />
        ) : null}
      </article>

      <AlertDialog
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        trigger={
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            {...stylex.props(styles.dialogTriggerPlaceholder)}
          />
        }
      >
        <AlertDialogHeader>Delete this review?</AlertDialogHeader>
        <AlertDialogDescription>
          This removes your review from this listing. You can post a new review
          later if you change your mind.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancelButton />
          <AlertDialogActionButton
            variant="critical"
            closeOnPress={false}
            isPending={deleteReview.isPending}
            onPress={() => void deleteReview.mutate()}
          >
            Delete review
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
