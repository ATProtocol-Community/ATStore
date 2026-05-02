import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  ProductListingForm,
  type ProductListingFormSubmitValues,
} from "#/components/product-listing-form";
import { Alert } from "../design-system/alert";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../design-system/alert-dialog";
import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import {
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Heading1 } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { buildRouteOgMeta } from "../lib/og-meta";

const styles = stylex.create({
  page: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["8xl"],
    paddingTop: verticalSpace["4xl"],
    width: "100%",
  },
  section: {
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace["5xl"],
    paddingBottom: verticalSpace["5xl"],
  },
  copy: {},
  alert: {
    maxWidth: "36rem",
    width: "100%",
  },
});

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

export const Route = createFileRoute("/$locale/_header-layout/products/create")(
  {
    loader: async ({ context }) => {
      const session = await context.queryClient.ensureQueryData(
        user.getSessionQueryOptions,
      );
      if (!session?.user?.did) {
        throw redirect({
          to: "/$locale/login",
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
  },
);

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
      <Page.Root variant="small" style={styles.page}>
        <Flex direction="column" gap="7xl" style={styles.section}>
          <Alert
            variant="warning"
            title="Listings submitted by non-owners will be disregarded."
          >
            We review submissions and remove any listing that wasn&rsquo;t
            created by the product&rsquo;s owner.
          </Alert>
          <Heading1>Are you the owner of this product?</Heading1>
          <Flex direction="column" gap="2xl">
            <Text size="lg" leading="base" variant="secondary">
              The at-store directory is built for the people who actually make
              the products it lists. Before you continue, please confirm that
              you represent this product — as a founder, team member, or someone
              officially authorized to speak for it.
            </Text>
            <Text size="base" leading="base" variant="secondary">
              If you&rsquo;re a fan, user, or third party: thank you for wanting
              to help, but please don&rsquo;t submit a listing on someone
              else&rsquo;s behalf. Ask the product&rsquo;s owner to submit it
              themselves.
            </Text>
            <Text size="base" leading="base" variant="secondary">
              To make this process easier create the listing with the same
              handle as the product. Example: if the product is "ATStore" create
              the listing with the handle "@atstore.fyi".
            </Text>
          </Flex>
        </Flex>
        <Page.StickyFooter>
          <Flex gap="md" justify="end" wrap>
            <Button
              variant="secondary"
              size="lg"
              onPress={() => {
                void navigate({ to: "/$locale/home" });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              onPress={() => {
                setHasAcknowledgedOwnership(true);
              }}
            >
              I own this product — continue
            </Button>
          </Flex>
        </Page.StickyFooter>
      </Page.Root>
    );
  }

  return (
    <>
      <ProductListingForm
        title="Create listing"
        description="Submit a new listing to the at-store directory. We'll review it and add it to the directory if it's a good fit!"
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
          void navigate({ to: "/$locale/home" });
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
              void navigate({ to: "/$locale/home" });
            }}
          >
            OK
          </AlertDialogActionButton>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
