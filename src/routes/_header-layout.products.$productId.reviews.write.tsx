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
import { useRef, useState } from "react";

import {
  ReviewFormCard,
  ReviewNoticeCard,
} from "../components/shelf/listing/ReviewFormCard";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Button } from "../design-system/button";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { blueskyReviewShareIntentHref } from "../lib/bluesky-review-share";
import { getLegacyDirectoryListingId } from "../lib/directory-listing-slugs";
import { buildRouteOgMeta } from "../lib/og-meta";
import { Route as ProductReviewsRoute } from "./_header-layout.products.$productId.reviews";

export const Route = createFileRoute(
  "/_header-layout/products/$productId/reviews/write",
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

    return {
      ogTitle: `Write a review for ${listing?.name || "this product"} | at-store`,
      ogDescription:
        listing?.tagline ||
        "Share your product review with the at-store community.",
      ogImage: listing?.heroImageUrl || null,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Write a review | at-store",
      description:
        loaderData?.ogDescription ||
        "Share your product review with the at-store community.",
      image: loaderData?.ogImage,
    }),
  component: ProductReviewWritePage,
});

const ButtonLink = createLink(Button);

const styles = stylex.create({
  /** Inert trigger for a controlled `AlertDialog`. */
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

function ProductReviewWritePage() {
  const { productId, productSlug } = ProductReviewsRoute.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [shareReviewId, setShareReviewId] = useState<string | null>(null);
  const skipShareDialogOpenChange = useRef(false);

  const navigateToProduct = () => {
    navigate({
      to: "/products/$productId",
      params: { productId: productSlug },
    });
  };

  const submitReview = useMutation({
    mutationFn: async () => {
      setFormError(null);
      return directoryListingApi.createDirectoryListingReview({
        data: {
          listingId: productId,
          rating: draftRating,
          text: draftText.trim() === "" ? null : draftText.trim(),
        },
      });
    },
    onSuccess: async (data) => {
      const did = session?.user?.did;
      if (did != null && did !== "") {
        await queryClient.invalidateQueries({
          queryKey:
            directoryListingApi.getUserProfileReviewsPageDataQueryOptions(did)
              .queryKey,
          exact: true,
        });
      }
      await queryClient.invalidateQueries({
        queryKey:
          directoryListingApi.getDirectoryListingReviewsQueryOptions(productId)
            .queryKey,
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey:
          directoryListingApi.getDirectoryListingDetailQueryOptions(productId)
            .queryKey,
        exact: true,
      });
      setShareReviewId(data.reviewId);
    },
    onError: (e: unknown) => {
      setFormError(
        e instanceof Error ? e.message : "Could not publish review.",
      );
    },
  });

  return (
    <>
      <AlertDialog
        isOpen={shareReviewId !== null}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          if (skipShareDialogOpenChange.current) {
            skipShareDialogOpenChange.current = false;
            return;
          }
          const id = shareReviewId;
          setShareReviewId(null);
          if (id != null) {
            navigateToProduct();
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
        <AlertDialogHeader>Share on Bluesky?</AlertDialogHeader>
        <AlertDialogDescription>
          Open Bluesky with a draft post that links to your review. You can edit
          it before you publish.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancelButton>Not now</AlertDialogCancelButton>
          <AlertDialogActionButton
            closeOnPress={false}
            onPress={() => {
              if (shareReviewId != null) {
                skipShareDialogOpenChange.current = true;
                window.open(
                  blueskyReviewShareIntentHref(productSlug, shareReviewId),
                  "_blank",
                  "noopener,noreferrer",
                );
                setShareReviewId(null);
                navigateToProduct();
              }
            }}
          >
            Open Bluesky
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>

      {session?.user ? (
        listing.atUri ? (
          <ReviewFormCard
            title="Write a review"
            listingName={listing.name}
            rating={draftRating}
            onRatingChange={setDraftRating}
            text={draftText}
            onTextChange={setDraftText}
            error={formError}
            isPending={submitReview.isPending}
            submitLabel="Publish review"
            onSubmit={() => submitReview.mutate()}
            cancel={{
              to: "/products/$productId",
              params: { productId: productSlug },
            }}
          />
        ) : (
          <ReviewNoticeCard title="Reviews aren't open yet">
            This listing is not linked to an AT Protocol record yet, so reviews
            cannot be published.
          </ReviewNoticeCard>
        )
      ) : (
        <ReviewNoticeCard
          title="Write a review"
          action={
            <ButtonLink
              to="/login"
              search={{
                redirect: `/products/${productSlug}/reviews/write`,
              }}
              size="lg"
            >
              Sign in to write a review
            </ButtonLink>
          }
        >
          Reviews are saved to your own repo, so you need to sign in first.
        </ReviewNoticeCard>
      )}
    </>
  );
}
