import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { StarRatingInput } from "../design-system/star-rating";
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
import { Route as ProductReviewsRoute } from "./_header-layout.products.$productId.reviews";
import { TextArea } from "#/design-system/text-area";
import { Form } from "#/design-system/form";

export const Route = createFileRoute(
  "/_header-layout/products/$productId/reviews/write",
)({
  component: ProductReviewWritePage,
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

function ProductReviewWritePage() {
  const { productId, productSlug } = ProductReviewsRoute.useLoaderData();
  const navigate = useNavigate();
  const detailQuery =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);

  const { data: listing } = useSuspenseQuery(detailQuery);
  const { data: session } = useQuery(user.getSessionQueryOptions);

  if (!listing) {
    throw notFound();
  }

  const [draftRating, setDraftRating] = useState(5);
  const [draftText, setDraftText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submitReview = useMutation({
    mutationFn: async () => {
      setFormError(null);
      await directoryListingApi.createDirectoryListingReview({
        data: {
          listingId: productId,
          rating: draftRating,
          text: draftText.trim() === "" ? null : draftText.trim(),
        },
      });
    },
    onSuccess: () => {
      navigate({
        to: "/products/$productId",
        params: { productId: productSlug },
      });
    },
    onError: (e: unknown) => {
      setFormError(
        e instanceof Error ? e.message : "Could not publish review.",
      );
    },
  });

  return (
    <Flex direction="column" gap="5xl">
      <Text weight="semibold" size="3xl">
        Write a review
      </Text>

      {session?.user ? (
        listing.atUri ? (
          <Card style={styles.reviewCard}>
            <Form
              style={styles.reviewCardBody}
              onSubmit={() => submitReview.mutate()}
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
                    submitReview.mutate();
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
                isPending={submitReview.isPending}
                onPress={() => submitReview.mutate()}
                type="submit"
              >
                Publish review
              </Button>
            </Form>
          </Card>
        ) : (
          <Body variant="secondary">
            This listing is not linked to an AT Protocol record yet, so reviews
            cannot be published.
          </Body>
        )
      ) : (
        <AppLink
          to="/login"
          search={{
            redirect: `/products/${productSlug}/reviews/write`,
          }}
        >
          Sign in to write a review
        </AppLink>
      )}
    </Flex>
  );
}
