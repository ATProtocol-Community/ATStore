import type { ProductListingFormSubmitValues } from "#/components/product-listing-form";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ProductListingForm } from "#/components/product-listing-form";
import { FormFooter } from "#/components/shelf/forms/FormFooter";
import { useState } from "react";

import { Alert } from "../design-system/alert";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../design-system/alert-dialog";
import { Button } from "../design-system/button";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { blobToBase64 } from "../lib/blob-to-base64";
import { buildRouteOgMeta } from "../lib/og-meta";

const styles = stylex.create({
  gate: {
    marginInline: "auto",
    fontFamily: fontFamily.sans,
    maxWidth: 740,
    paddingTop: { default: 28, [breakpoints.md]: 40 },
  },
  title: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 34, [breakpoints.md]: 44 },
    fontWeight: 750,
    letterSpacing: "-0.025em",
    lineHeight: 1.05,
    textWrap: "balance",
    marginBottom: 18,
    marginTop: 28,
  },
  prose: {
    color: uiColor.text2,
    fontSize: { default: 16, [breakpoints.md]: 18 },
    lineHeight: 1.65,
  },
  paragraph: {
    marginBottom: 14,
    marginTop: 0,
  },
  quote: {
    marginInline: 0,
    paddingBlock: 4,
    color: uiColor.text2,
    fontSize: { default: 16, [breakpoints.md]: 17 },
    lineHeight: 1.55,
    borderLeftColor: uiColor.text2,
    borderLeftStyle: "solid",
    borderLeftWidth: 3,
    marginBottom: 24,
    marginTop: 24,
    paddingLeft: 20,
  },
  strong: {
    fontWeight: fontWeight.semibold,
  },
  // wrap-reverse: when the buttons stack on narrow phones, the primary
  // action ends up on top.
  actions: {
    columnGap: 10,
    display: "flex",
    flexWrap: "wrap-reverse",
    justifyContent: "flex-end",
    rowGap: 10,
  },
  // Phones: the two buttons share the row (or stack) at full width.
  grow: {
    flexGrow: { default: 1, [breakpoints.sm]: 0 },
  },
});

export const Route = createFileRoute("/_header-layout/products/create")({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user?.did) {
      throw redirect({
        to: "/login",
        search: { redirect: "/products/create" },
      });
    }
  },
  head: () =>
    buildRouteOgMeta({
      title: "Create product listing | at-store",
      description:
        "Publish a new listing to your PDS and add it to the at-store directory.",
    }),
  component: CreateProductListingPage,
});

function CreateProductListingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmittedDialogOpen, setIsSubmittedDialogOpen] = useState(false);
  const [hasAcknowledgedOwnership, setHasAcknowledgedOwnership] =
    useState(false);

  const publishMutation = useMutation({
    mutationFn: async (values: ProductListingFormSubmitValues) => {
      const heroImage = values.pendingHeroBlob
        ? {
            mimeType:
              values.pendingHeroBlob.type &&
              values.pendingHeroBlob.type.startsWith("image/")
                ? values.pendingHeroBlob.type
                : "image/png",
            imageBase64: await blobToBase64(values.pendingHeroBlob),
          }
        : undefined;
      const iconImage = values.pendingIconBlob
        ? {
            mimeType:
              values.pendingIconBlob.type &&
              values.pendingIconBlob.type.startsWith("image/")
                ? values.pendingIconBlob.type
                : "image/png",
            imageBase64: await blobToBase64(values.pendingIconBlob),
          }
        : undefined;
      const screenshotImages =
        values.pendingScreenshotBlobs.length > 0
          ? await Promise.all(
              values.pendingScreenshotBlobs.map(async (blob) => ({
                mimeType:
                  blob.type && blob.type.startsWith("image/")
                    ? blob.type
                    : "image/png",
                imageBase64: await blobToBase64(blob),
              })),
            )
          : undefined;

      return directoryListingApi.createOwnedProductListing({
        data: {
          name: values.name,
          tagline: values.tagline,
          fullDescription: values.fullDescription,
          externalUrl: values.externalUrl,
          categorySlug: values.categorySlug,
          productHandle: values.productHandle,
          links: values.links,
          appTags: values.appTags,
          ...(heroImage ? { heroImage } : {}),
          ...(iconImage ? { iconImage } : {}),
          ...(screenshotImages ? { screenshotImages } : {}),
        },
      });
    },
    onSuccess: async () => {
      setIsSubmittedDialogOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    },
  });

  if (!hasAcknowledgedOwnership) {
    return (
      <div {...stylex.props(styles.gate)}>
        <Alert
          variant="warning"
          title="Listings submitted by non-owners will be disregarded."
        >
          We review submissions and remove any listing that wasn&rsquo;t created
          by the product&rsquo;s owner.
        </Alert>
        <h1 {...stylex.props(styles.title)}>
          Are you the owner of this product?
        </h1>
        <div {...stylex.props(styles.prose)}>
          <p {...stylex.props(styles.paragraph)}>
            The at-store directory is built for the people who actually make the
            products it lists. Before you continue, please confirm that you
            represent this product — as a founder, team member, or someone
            officially authorized to speak for it.
          </p>
          <p {...stylex.props(styles.paragraph)}>
            If you&rsquo;re a fan, user, or third party: thank you for wanting
            to help, but please don&rsquo;t submit a listing on someone
            else&rsquo;s behalf. Ask the product&rsquo;s owner to submit it
            themselves.
          </p>
          <p {...stylex.props(styles.paragraph)}>
            To make this easier, create the listing while signed in as the
            product&rsquo;s own account. If the product is
            &ldquo;ATStore&rdquo;, sign in as{" "}
            <b {...stylex.props(styles.strong)}>@atstore.fyi</b>.
          </p>
        </div>
        <blockquote {...stylex.props(styles.quote)}>
          If your product is already listed, you can claim it with the
          &ldquo;Claim&rdquo; button on its listing page.
        </blockquote>
        <FormFooter>
          <div {...stylex.props(styles.actions)}>
            <Button
              variant="secondary"
              size="lg"
              style={styles.grow}
              onPress={() => {
                void navigate({ to: "/home" });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              style={styles.grow}
              onPress={() => {
                setHasAcknowledgedOwnership(true);
              }}
            >
              I own this product — continue
            </Button>
          </div>
        </FormFooter>
      </div>
    );
  }

  return (
    <>
      <ProductListingForm
        eyebrow="Submit an app"
        title="Create listing"
        description="Submit a new listing to the at-store directory. We'll review it and add it to the directory if it's a good fit!"
        footerNote="We'll review it before it appears in the directory."
        submitLabel="Publish"
        isSubmitting={publishMutation.isPending}
        initialValues={{
          name: "",
          tagline: "",
          fullDescription: "",
          externalUrl: "",
          productHandle: "",
          categorySlug: "",
          heroImageUrl: null,
          iconUrl: null,
          screenshotUrls: [],
          links: [],
        }}
        onCancel={() => {
          void navigate({ to: "/home" });
        }}
        onSubmit={(values) => {
          setIsSubmittedDialogOpen(false);
          publishMutation.mutate(values);
        }}
        errorMessage={
          publishMutation.isError
            ? publishMutation.error instanceof Error
              ? publishMutation.error.message
              : "Could not publish listing."
            : null
        }
      />
      <AlertDialog
        trigger={<span />}
        isOpen={isSubmittedDialogOpen}
        onOpenChange={setIsSubmittedDialogOpen}
      >
        <AlertDialogDescription>
          Your listing has been submitted for review.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogActionButton
            closeOnPress={false}
            onPress={() => {
              void navigate({ to: "/home" });
            }}
          >
            OK
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
