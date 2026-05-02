import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as TanstackLink, createLink } from "@tanstack/react-router";
import { MoreVertical, Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";

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
import {
  Card,
  CardBody,
  CardHeader,
  CardHeaderAction,
} from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Form } from "../design-system/form";
import { IconButton } from "../design-system/icon-button";
import { Menu, MenuItem } from "../design-system/menu";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { Text } from "../design-system/typography/text";
import { TextArea } from "../design-system/text-area";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { blueskyReviewShareIntentHref } from "../lib/bluesky-review-share";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/get-initials";
import { RestrictedMarkdownContent } from "./restricted-markdown-content";

const IconButtonLink = createLink(IconButton);

const styles = stylex.create({
  reviewedListingCardBody: {
    paddingBottom: verticalSpace["xl"],
    paddingTop: verticalSpace["xl"],
  },
  reviewCard: {
    boxShadow: shadow.sm,
    height: "100%",
  },
  reviewCardBody: {
    gap: gap["5xl"],
    height: "100%",
  },
  reviewHeader: {
    alignItems: "center",
  },
  reviewAuthor: {
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  reviewMeta: {
    color: uiColor.text1,
  },
  reviewQuoteParagraph: {
    fontSize: fontSize["lg"],
  },
  ratingActions: {
    gap: gap.sm,
    alignItems: "center",
    flexShrink: 0,
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
  profileLink: {
    borderRadius: radius.md,
    textDecoration: "none",
    color: "inherit",
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    outlineOffset: 2,
    minWidth: 0,
  },
  authorLinkRow: {
    gap: gap["2xl"],
    alignItems: "center",
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  reviewSubjectLink: {
    textDecoration: "none",
    color: "inherit",
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  reviewSubjectMedia: {
    gap: gap["2xl"],
    alignItems: "center",
    flexBasis: "0%",
    flexGrow: "1",
    flexShrink: "1",
    minWidth: 0,
  },
  listingTagline: {
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    display: "-webkit-box",
  },
  replyThread: {
    marginTop: verticalSpace.md,
    paddingLeft: horizontalSpace.md,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: uiColor.border2,
    gap: gap.md,
    display: "flex",
    flexDirection: "column",
  },
  replyRow: {
    gap: gap.xl,
  },
  replyBodyParagraph: {
    fontSize: fontSize.sm,
  },
});

export type DirectoryListingReviewCardProps = {
  review: DirectoryListingReview;
  /** Store listing UUID — used to invalidate review queries after delete. */
  listingId: string;
  /** When set and equal to `review.authorDid`, shows the overflow menu for edit/delete. */
  viewerDid?: string | null;
  onEditReview?: () => void;
  /** Forwarded to the outer `Card` for layout contexts (e.g. grids). */
  style?: stylex.StyleXStyles;
  /** When true (default), avatar and name link to the reviewer profile. */
  linkAuthorProfile?: boolean;
  /** When set, the card highlights the listing being reviewed (e.g. profile page). */
  reviewedListing?: DirectoryUserReviewListing;
  /** Anchor for scroll/deep links (`?review=`). */
  anchorId?: string;
  /** Canonical product slug — enables “Share” (Bluesky) for this review. */
  shareProductSlug?: string | null;
};

function authorLabelFor(review: DirectoryListingReview) {
  return (
    review.authorDisplayName?.trim() ||
    (review.authorDid.length > 16
      ? `${review.authorDid.slice(0, 10)}…`
      : review.authorDid)
  );
}

function authorLabelForReply(reply: DirectoryListingReviewReply): string {
  return (
    reply.authorDisplayName?.trim() ||
    (reply.authorDid.length > 16
      ? `${reply.authorDid.slice(0, 10)}…`
      : reply.authorDid)
  );
}

function ReviewConversationSection({
  listingId,
  review,
  viewerDid,
  linkAuthorProfile,
}: {
  listingId: string;
  review: DirectoryListingReview;
  viewerDid?: string | null;
  linkAuthorProfile: boolean;
}) {
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
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
      setComposerOpen(false);
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
  const showComposerControls = review.canReply;

  const authorRowForReply = (reply: DirectoryListingReviewReply) => {
    const label = authorLabelForReply(reply);
    const inner = (
      <Flex style={styles.authorLinkRow}>
        <Avatar
          alt={label}
          fallback={getInitials(label)}
          src={reply.authorAvatarUrl || undefined}
        />
        <Flex direction="column" gap="sm" style={styles.reviewAuthor}>
          <Text weight="medium" size="sm">
            {label}
          </Text>
        </Flex>
      </Flex>
    );
    return linkAuthorProfile ? (
      <TanstackLink
        to="/profile/$actor"
        params={{ actor: reply.authorDid }}
        {...stylex.props(styles.profileLink)}
      >
        {inner}
      </TanstackLink>
    ) : (
      inner
    );
  };

  const isReplyAuthor = (did: string) =>
    viewerDid != null && viewerDid !== "" && viewerDid.trim() === did.trim();

  return (
    <>
      <Flex direction="column" gap="xl" style={styles.replyThread}>
        {review.replyCount > 0 ? (
          repliesQuery.isPending ? (
            <Text size="sm" variant="secondary">
              Loading replies…
            </Text>
          ) : (
            <Flex direction="column" gap="xl">
              {replies.map((reply) => (
                <Flex
                  key={reply.id}
                  direction="column"
                  gap="md"
                  id={`listing-review-reply-${reply.id}`}
                  style={styles.replyRow}
                >
                  <Flex gap="xl" justify="between" align="start">
                    <Flex style={styles.reviewAuthor}>
                      {authorRowForReply(reply)}
                    </Flex>
                    {isReplyAuthor(reply.authorDid) ? (
                      <Menu
                        placement="bottom end"
                        trigger={
                          <IconButton
                            aria-label="Reply actions"
                            variant="tertiary"
                            size="lg"
                          >
                            <MoreVertical size={18} />
                          </IconButton>
                        }
                      >
                        <MenuItem
                          prefix={<Pencil size={16} />}
                          onPress={() => {
                            setEditingReplyId(reply.id);
                            setEditDraft(reply.text);
                            setComposerOpen(false);
                          }}
                        >
                          Edit reply
                        </MenuItem>
                        <MenuItem
                          variant="destructive"
                          prefix={<Trash2 size={16} />}
                          onPress={() => setDeleteReplyId(reply.id)}
                        >
                          Delete reply
                        </MenuItem>
                      </Menu>
                    ) : null}
                  </Flex>
                  {editingReplyId === reply.id ? (
                    <Form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = editDraft.trim();
                        if (trimmed.length === 0) return;
                        setFormError(null);
                        updateReply.mutate({
                          replyId: reply.id,
                          text: trimmed,
                        });
                      }}
                    >
                      <Flex direction="column" gap="md">
                        <TextArea
                          aria-label="Edit reply"
                          value={editDraft}
                          rows={4}
                          onChange={setEditDraft}
                        />
                        {formError && editingReplyId === reply.id ? (
                          <Text size="xs" variant="secondary">
                            {formError}
                          </Text>
                        ) : null}
                        <Flex gap="md">
                          <Button
                            size="sm"
                            type="submit"
                            variant="secondary"
                            isPending={updateReply.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            variant="tertiary"
                            onPress={() => {
                              setEditingReplyId(null);
                              setEditDraft("");
                              setFormError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </Flex>
                      </Flex>
                    </Form>
                  ) : (
                    <RestrictedMarkdownContent
                      content={reply.text}
                      paragraphStyle={styles.replyBodyParagraph}
                    />
                  )}
                  <Text size="xs" variant="secondary" style={styles.reviewMeta}>
                    {new Date(reply.replyCreatedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Text>
                </Flex>
              ))}
            </Flex>
          )
        ) : null}

        {showComposerControls ? (
          composerOpen ? (
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = draft.trim();
                if (trimmed.length === 0) return;
                setFormError(null);
                createReply.mutate();
              }}
            >
              <Flex direction="column" gap="md">
                <TextArea
                  aria-label="Write a reply"
                  rows={4}
                  value={draft}
                  placeholder="Write a reply..."
                  onChange={setDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) {
                      e.preventDefault();
                      if (draft.trim().length === 0) return;
                      setFormError(null);
                      createReply.mutate();
                    }
                  }}
                />
                {formError && editingReplyId == null ? (
                  <Text size="xs" variant="secondary">
                    {formError}
                  </Text>
                ) : null}
                <Flex gap="md" wrap>
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    isPending={createReply.isPending}
                  >
                    Post reply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="tertiary"
                    onPress={() => {
                      setComposerOpen(false);
                      setDraft("");
                      setFormError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </Flex>
              </Flex>
            </Form>
          ) : (
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => {
                setComposerOpen(true);
                setEditingReplyId(null);
              }}
            >
              Reply
            </Button>
          )
        ) : null}
      </Flex>

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
}: DirectoryListingReviewCardProps) {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const authorLabel = authorLabelFor(review);
  const isAuthor =
    viewerDid != null && viewerDid !== "" && viewerDid === review.authorDid;
  const showAuthorMenu = isAuthor;
  const listingProductId = reviewedListing
    ? getDirectoryListingSlug(reviewedListing)
    : null;
  const listingInitials = reviewedListing
    ? getInitials(reviewedListing.name)
    : "";

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

  return (
    <>
      <Card id={anchorId} style={[styles.reviewCard, style]}>
        {reviewedListing && listingProductId ? (
          <CardHeader hasBorder>
            <TanstackLink
              to="/products/$productId"
              params={{ productId: listingProductId }}
              {...stylex.props(styles.reviewSubjectLink)}
            >
              <Flex style={styles.reviewSubjectMedia}>
                <Avatar
                  alt={reviewedListing.name}
                  fallback={listingInitials}
                  size="lg"
                  src={reviewedListing.iconUrl || undefined}
                />
                <Flex direction="column" gap="sm" style={styles.reviewAuthor}>
                  <Text size="xs" variant="secondary">
                    Review for
                  </Text>
                  <Text weight="semibold" size="lg">
                    {reviewedListing.name}
                  </Text>
                  {reviewedListing.tagline ? (
                    <Text
                      size="sm"
                      variant="secondary"
                      style={styles.listingTagline}
                    >
                      {reviewedListing.tagline}
                    </Text>
                  ) : null}
                </Flex>
              </Flex>
            </TanstackLink>
            <CardHeaderAction>
              <Flex style={styles.ratingActions}>
                <StarRating rating={review.rating} showReviewCount={false} />
                {shareProductSlug ? (
                  <IconButtonLink
                    to={blueskyReviewShareIntentHref(
                      shareProductSlug,
                      review.id,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share review on Bluesky"
                    variant="tertiary"
                    size="lg"
                  >
                    <Share2 size={18} />
                  </IconButtonLink>
                ) : null}
                {showAuthorMenu ? (
                  <Menu
                    placement="bottom end"
                    trigger={
                      <IconButton
                        aria-label="Review actions"
                        variant="tertiary"
                        size="lg"
                      >
                        <MoreVertical size={18} />
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
              </Flex>
            </CardHeaderAction>
          </CardHeader>
        ) : null}
        <CardBody>
          <Flex
            direction="column"
            style={[
              styles.reviewCardBody,
              listingProductId && reviewedListing
                ? styles.reviewedListingCardBody
                : undefined,
            ]}
          >
            {reviewedListing && listingProductId ? (
              <>
                {review.text ? (
                  <RestrictedMarkdownContent
                    content={review.text}
                    paragraphStyle={styles.reviewQuoteParagraph}
                  />
                ) : null}
                <Text size="sm" variant="secondary" style={styles.reviewMeta}>
                  {new Date(review.reviewCreatedAt).toLocaleDateString(
                    undefined,
                    {
                      dateStyle: "medium",
                    },
                  )}
                </Text>
                {review.replyCount > 0 || review.canReply ? (
                  <ReviewConversationSection
                    listingId={listingId}
                    linkAuthorProfile={linkAuthorProfile}
                    review={review}
                    viewerDid={viewerDid ?? null}
                  />
                ) : null}
              </>
            ) : (
              <>
                <Flex gap="2xl" style={styles.reviewHeader}>
                  {linkAuthorProfile ? (
                    <TanstackLink
                      to="/profile/$actor"
                      params={{ actor: review.authorDid }}
                      {...stylex.props(styles.profileLink)}
                    >
                      <Flex style={styles.authorLinkRow}>
                        <Avatar
                          alt={authorLabel}
                          fallback={getInitials(authorLabel)}
                          src={review.authorAvatarUrl || undefined}
                        />
                        <Flex
                          direction="column"
                          gap="lg"
                          style={styles.reviewAuthor}
                        >
                          <Text weight="semibold">{authorLabel}</Text>
                        </Flex>
                      </Flex>
                    </TanstackLink>
                  ) : (
                    <Flex style={styles.authorLinkRow}>
                      <Avatar
                        alt={authorLabel}
                        fallback={getInitials(authorLabel)}
                        src={review.authorAvatarUrl || undefined}
                      />
                      <Flex
                        direction="column"
                        gap="lg"
                        style={styles.reviewAuthor}
                      >
                        <Text weight="semibold">{authorLabel}</Text>
                      </Flex>
                    </Flex>
                  )}
                  <Flex style={styles.ratingActions}>
                    <StarRating
                      rating={review.rating}
                      showReviewCount={false}
                    />
                    {shareProductSlug ? (
                      <IconButtonLink
                        to={blueskyReviewShareIntentHref(
                          shareProductSlug,
                          review.id,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Share review on Bluesky"
                        variant="tertiary"
                        size="lg"
                      >
                        <Share2 size={18} />
                      </IconButtonLink>
                    ) : null}
                    {showAuthorMenu ? (
                      <Menu
                        placement="bottom end"
                        trigger={
                          <IconButton
                            aria-label="Review actions"
                            variant="tertiary"
                            size="lg"
                          >
                            <MoreVertical size={18} />
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
                  </Flex>
                </Flex>
                {review.text ? (
                  <RestrictedMarkdownContent
                    content={review.text}
                    paragraphStyle={styles.reviewQuoteParagraph}
                  />
                ) : null}
                <Text size="sm" variant="secondary" style={styles.reviewMeta}>
                  {new Date(review.reviewCreatedAt).toLocaleDateString(
                    undefined,
                    {
                      dateStyle: "medium",
                    },
                  )}
                </Text>
                {review.replyCount > 0 || review.canReply ? (
                  <ReviewConversationSection
                    listingId={listingId}
                    linkAuthorProfile={linkAuthorProfile}
                    review={review}
                    viewerDid={viewerDid ?? null}
                  />
                ) : null}
              </>
            )}
          </Flex>
        </CardBody>
      </Card>

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
