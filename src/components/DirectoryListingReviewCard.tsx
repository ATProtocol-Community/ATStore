import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link as TanstackLink } from "@tanstack/react-router";
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
import { fontSize } from "../design-system/theme/typography.stylex";
import { radius } from "../design-system/theme/radius.stylex";
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
  type DirectoryUserReviewListing,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { getInitials } from "../lib/product-reviews-route";

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
    flex: 1,
    minWidth: 0,
  },
  reviewMeta: {
    color: uiColor.text1,
  },
  reviewQuote: {
    fontSize: fontSize["lg"],
    whiteSpace: "pre-wrap",
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
  profileLink: {
    borderRadius: radius.md,
    color: "inherit",
    flex: 1,
    minWidth: 0,
    outlineOffset: 2,
    textDecoration: "none",
  },
  authorLinkRow: {
    alignItems: "center",
    flex: 1,
    gap: gap["2xl"],
    minWidth: 0,
  },
  reviewSubjectLink: {
    color: "inherit",
    flex: 1,
    minWidth: 0,
    textDecoration: "none",
  },
  reviewSubjectMedia: {
    alignItems: "center",
    flex: 1,
    gap: gap["2xl"],
    minWidth: 0,
  },
  listingTagline: {
    display: "-webkit-box",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  },
  reviewSubjectBar: {
    alignItems: "flex-start",
    backgroundColor: uiColor.bgSubtle,
    borderColor: uiColor.border2,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: 1,
    boxSizing: "border-box",
    gap: gap["2xl"],
    justifyContent: "space-between",
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
    width: "100%",
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
      <Card style={[styles.reviewCard, style]}>
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
                  <Body style={styles.reviewQuote}>{review.text}</Body>
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
