import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Avatar } from "../design-system/avatar";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { IconButton } from "../design-system/icon-button";
import { Menu, MenuItem } from "../design-system/menu";
import { StarRating } from "../design-system/star-rating";
import { uiColor } from "../design-system/theme/color.stylex";
import { fontSize } from "../design-system/theme/typography.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingReview,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { getInitials } from "../lib/product-reviews-route";

const styles = stylex.create({
  reviewCard: {
    boxShadow: shadow.sm,
    height: "100%",
  },
  reviewCardBody: {
    gap: gap["5xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  reviewHeader: {
    alignItems: "center",
  },
  reviewAuthor: {
    flex: 1,
    minWidth: 0,
  },
  reviewMeta: {
    color: uiColor.text1,
  },
  reviewQuote: {
    fontSize: fontSize["lg"],
  },
  ratingActions: {
    alignItems: "center",
    flexShrink: 0,
    gap: gap.sm,
  },
  /** Inert trigger so `AlertDialog` can be opened only via `isOpen` (e.g. from the menu). */
  dialogTriggerPlaceholder: {
    borderWidth: 0,
    clip: "rect(0, 0, 0, 0)",
    height: 1,
    margin: -1,
    overflow: "hidden",
    padding: 0,
    position: "absolute",
    whiteSpace: "nowrap",
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
  /** Forwarded to the outer `Card` for layout contexts (e.g. grids). */
  style?: stylex.StyleXStyles;
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
}: DirectoryListingReviewCardProps) {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const authorLabel = authorLabelFor(review);
  const isAuthor =
    viewerDid != null && viewerDid !== "" && viewerDid === review.authorDid;
  const showAuthorMenu = isAuthor;

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
      ]);
    },
  });

  return (
    <>
      <Card style={[styles.reviewCard, style]}>
        <Flex direction="column" style={styles.reviewCardBody}>
          <Flex gap="2xl" style={styles.reviewHeader}>
            <Avatar
              alt={authorLabel}
              fallback={getInitials(authorLabel)}
              src={review.authorAvatarUrl || undefined}
            />
            <Flex direction="column" gap="lg" style={styles.reviewAuthor}>
              <Text weight="semibold">{authorLabel}</Text>
            </Flex>
            <Flex style={styles.ratingActions}>
              <StarRating rating={review.rating} showReviewCount={false} />
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
            <Body style={styles.reviewQuote}>{review.text}</Body>
          ) : null}
          <Text size="sm" variant="secondary" style={styles.reviewMeta}>
            {new Date(review.reviewCreatedAt).toLocaleDateString(undefined, {
              dateStyle: "medium",
            })}
          </Text>
        </Flex>
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
