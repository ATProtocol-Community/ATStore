import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import type { ProductListingFormSubmitValues } from "../components/product-listing-form";

import { ProductListingForm } from "../components/product-listing-form";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { blobToBase64 } from "../lib/blob-to-base64";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/add-listing",
)({
  component: AdminAddListingPage,
});

function AdminAddListingPage() {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const createMutation = useMutation({
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
      const screenshotImages = await Promise.all(
        values.pendingScreenshotBlobs.map(async (blob) => ({
          mimeType:
            blob.type && blob.type.startsWith("image/")
              ? blob.type
              : "image/png",
          imageBase64: await blobToBase64(blob),
        })),
      );

      return directoryListingApi.createStoreManagedListing({
        data: {
          name: values.name,
          tagline: values.tagline,
          fullDescription: values.fullDescription,
          externalUrl: values.externalUrl,
          categorySlug: values.categorySlug,
          productHandle: values.productHandle,
          links: values.links,
          appTags: values.appTags,
          heroImage,
          iconImage,
          screenshotImages,
        },
      });
    },
    onSuccess: (result) => {
      setSuccessMessage(
        `Published new listing to the store PDS (${result.slug}). Tap ingest will import it shortly.`,
      );
    },
    onError: () => {
      setSuccessMessage(null);
    },
  });

  return (
    <ProductListingForm
      isAdmin
      title="New listing"
      description="Create a new ATStore managed listing."
      submitLabel="Publish to store PDS"
      isSubmitting={createMutation.isPending}
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
        appTags: [],
      }}
      onCancel={() => {
        void navigate({ to: "/admin" });
      }}
      onSubmit={(values) => createMutation.mutate(values)}
      errorMessage={
        createMutation.isError
          ? createMutation.error instanceof Error
            ? createMutation.error.message
            : "Could not publish."
          : null
      }
      successMessage={successMessage}
    />
  );
}
