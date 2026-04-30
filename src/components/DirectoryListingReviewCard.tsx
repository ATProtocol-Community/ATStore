import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link as TanstackLink, createLink } from "@tanstack/react-router";
import { MoreVertical, Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";

import type {
  DirectoryListingReview,
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
import {
  Card,
  CardBody,
  CardHeader,
  CardHeaderAction,
} from "../design-system/card";
import { Flex } from "../design-system/flex";
import { IconButton } from "../design-system/icon-button";
import { Menu, MenuItem } from "../design-system/menu";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import { Text } from "../design-system/typography/text";
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
