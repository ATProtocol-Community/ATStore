import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";

import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Form } from "#/design-system/form";
import { Link } from "../design-system/link";
import { StarRatingInput } from "../design-system/star-rating";
import { TextArea } from "#/design-system/text-area";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { getLegacyDirectoryListingId } from "../lib/directory-listing-slugs";
import { Route as ProductReviewsRoute } from "./_header-layout.products.$productId.reviews";

export const Route = createFileRoute(
  "/_header-layout/products/$productId/reviews/$reviewId/edit",
)({
  loader: async ({ context, params }) => {
    const legacyListingId = getLegacyDirectoryListingId(params.productId);
    const listing = await context.queryClient.ensureQueryData(
      legacyListingId
        ? directoryListingApi.getDirectoryListingDetailQueryOptions(
            legacyListingId,
          )
        : directoryListingApi.getDirectoryListingDetailBySlugQueryOptions(
            params.productId,
          ),
    );

    if (!listing) {
      throw notFound();
    }

    const reviews = await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingReviewsQueryOptions(listing.id),
    );

    const review = reviews.find((r) => r.id === params.reviewId);
    if (!review) {
      throw notFound();
    }

    return { review };
  },
  component: ProductReviewEditPage,
});

const AppLink = createLink(Link);

const styles = stylex.create({
  reviewCard: {
    boxShadow: shadow.sm,
    height: "100%",
  },
  reviewCardBody: {
    display: "flex",
    flexDirection: "column",
    gap: gap["5xl"],
    height: "100%",
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
});

function ProductReviewEditPage() {
  const { productId, productSlug } = ProductReviewsRoute.useLoaderData();
  const { review } = Route.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const detailQuery =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);
  const { data: listing } = useSuspenseQuery(detailQuery);
  const { data: session, isPending: sessionPending } = useQuery(
    user.getSessionQueryOptions,
  );

  const [draftRating, setDraftRating] = useState(review.rating);
  const [draftText, setDraftText] = useState(review.text ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const isWrongUser =
    !sessionPending &&
    session != null &&
    session.user != null &&
    session.user.did !== review.authorDid;

  useLayoutEffect(() => {
    if (isWrongUser) {
      void navigate({
        to: "/products/$productId/reviews",
        params: { productId: productSlug },
        replace: true,
      });
    }
  }, [isWrongUser, navigate, productSlug]);

  if (!listing) {
    throw notFound();
  }

  if (sessionPending) {
    return null;
  }

  if (isWrongUser) {
    return null;
  }

  const saveReview = useMutation({
    mutationFn: async () => {
      setFormError(null);
      await directoryListingApi.updateDirectoryListingReview({
        data: {
          reviewId: review.id,
          rating: draftRating,
          text: draftText.trim() === "" ? null : draftText.trim(),
        },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: directoryListingApi.getDirectoryListingReviewsQueryOptions(
            productId,
          ).queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: detailQuery.queryKey,
          exact: true,
        }),
      ]);
      navigate({
        to: "/products/$productId",
        params: { productId: productSlug },
      });
    },
    onError: (e: unknown) => {
      setFormError(
        e instanceof Error ? e.message : "Could not save your review.",
      );
    },
  });

  return (
    <Flex direction="column" gap="5xl">
      <Text weight="semibold" size="3xl">
        Edit review
      </Text>

      {session?.user ? (
        listing.atUri ? (
          <Card style={styles.reviewCard}>
            <Form
              style={styles.reviewCardBody}
              onSubmit={() => saveReview.mutate()}
            >
              <Flex gap="2xl" align="center">
                <Text size="sm" variant="secondary">
                  Rating
                </Text>
                <StarRatingInput
                  value={draftRating}
                  onChange={setDraftRating}
                  aria-label="Your star rating"
                />
              </Flex>
              <TextArea
                size="lg"
                id="review-body"
                aria-label="Review (optional)"
                value={draftText}
                onChange={setDraftText}
                rows={4}
                placeholder="Write your review here... (optional)"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) {
                    saveReview.mutate();
                  }
                }}
              />
              {formError ? (
                <Text size="sm" variant="secondary">
                  {formError}
                </Text>
              ) : null}
              <Button
                size="lg"
                variant="secondary"
                isPending={saveReview.isPending}
                onPress={() => saveReview.mutate()}
                type="submit"
              >
                Save changes
              </Button>
            </Form>
          </Card>
        ) : (
          <Body variant="secondary">
            This listing is not linked to an AT Protocol record yet, so reviews
            cannot be updated.
          </Body>
        )
      ) : (
        <AppLink
          to="/login"
          search={{
            redirect: `/products/${productSlug}/reviews/${review.id}/edit`,
          }}
        >
          Sign in to edit your review
        </AppLink>
      )}
    </Flex>
  );
}
