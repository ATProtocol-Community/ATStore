import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  ProductListingForm,
  type ProductListingFormSubmitValues,
} from "#/components/product-listing-form";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../design-system/alert-dialog";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { buildRouteOgMeta } from "../lib/og-meta";

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result;
      if (typeof s !== "string") {
        reject(new Error("Could not read image."));
        return;
      }
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Could not read image."));
    };
    reader.readAsDataURL(blob);
  });
}

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

      return directoryListingApi.createOwnedProductListing({
        data: {
          name: values.name,
          tagline: values.tagline,
          fullDescription: values.fullDescription,
          externalUrl: values.externalUrl,
          categorySlug: values.categorySlug,
          productHandle: values.productHandle,
          ...(heroImage ? { heroImage } : {}),
          ...(iconImage ? { iconImage } : {}),
        },
      });
    },
    onSuccess: async () => {
      setIsSubmittedDialogOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    },
  });

  return (
    <>
      <ProductListingForm
        title="Create listing"
        description="Publish a new listing record to your PDS. Ingestion will create an unverified directory entry shortly after."
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
        }}
        onCancel={() => {
          void navigate({ to: "/" });
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
              void navigate({ to: "/" });
            }}
          >
            OK
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
