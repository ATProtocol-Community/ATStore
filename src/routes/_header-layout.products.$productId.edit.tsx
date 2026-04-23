import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  notFound,
  redirect,
  useNavigate,
} from "@tanstack/react-router";

import {
  ProductListingForm,
  type ProductListingFormSubmitValues,
} from "#/components/product-listing-form";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";

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

export const Route = createFileRoute(
  "/_header-layout/products/$productId/edit",
)({
  loader: async ({ context, params }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user?.did) {
      throw redirect({
        to: "/login",
        search: {
          redirect: `/products/${params.productId}/edit`,
        },
      });
    }

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

    const productSlug = getDirectoryListingSlug(listing);
    if (params.productId !== productSlug) {
      throw redirect({
        to: "/products/$productId/edit",
        params: { productId: productSlug },
        replace: true,
      });
    }

    const access = await context.queryClient.ensureQueryData(
      directoryListingApi.getProductListingEditAccessQueryOptions(listing.id),
    );

    if (!access.canEdit) {
      throw redirect({
        to: "/products/$productId",
        params: { productId: productSlug },
        replace: true,
      });
    }

    return { productId: listing.id, productSlug };
  },
  component: EditProductListingPage,
});

function EditProductListingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { productId, productSlug } = Route.useLoaderData();

  const detailQuery =
    directoryListingApi.getDirectoryListingDetailQueryOptions(productId);
  const { data: listing } = useSuspenseQuery(detailQuery);

  if (!listing) {
    throw notFound();
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ProductListingFormSubmitValues) => {
      const result = await directoryListingApi.updateOwnedProductListing({
        data: {
          listingId: productId,
          name: values.name,
          tagline: values.tagline,
          fullDescription: values.fullDescription,
          externalUrl: values.externalUrl,
          categorySlug: values.categorySlug,
          productHandle: values.productHandle,
          links: values.links,
          appTags: values.appTags,
        },
      });

      if (values.pendingHeroBlob) {
        const mimeType =
          values.pendingHeroBlob.type &&
          values.pendingHeroBlob.type.startsWith("image/")
            ? values.pendingHeroBlob.type
            : "image/png";
        const imageBase64 = await blobToBase64(values.pendingHeroBlob);
        await directoryListingApi.updateOwnedProductListingImage({
          data: {
            listingId: productId,
            kind: "hero",
            mimeType,
            imageBase64,
          },
        });
      }

      if (values.pendingIconBlob) {
        const mimeType =
          values.pendingIconBlob.type &&
          values.pendingIconBlob.type.startsWith("image/")
            ? values.pendingIconBlob.type
            : "image/png";
        const imageBase64 = await blobToBase64(values.pendingIconBlob);
        await directoryListingApi.updateOwnedProductListingImage({
          data: {
            listingId: productId,
            kind: "icon",
            mimeType,
            imageBase64,
          },
        });
      }

      const initialScreenshotUrls = (listing.screenshots ?? []).slice(0, 4);
      const retainedScreenshotUrls = values.retainedScreenshotUrls;
      const screenshotsChanged =
        values.pendingScreenshotBlobs.length > 0 ||
        retainedScreenshotUrls.length !== initialScreenshotUrls.length ||
        retainedScreenshotUrls.some(
          (url, index) => url !== initialScreenshotUrls[index],
        );

      if (screenshotsChanged) {
        await directoryListingApi.updateOwnedProductListingScreenshots({
          data: {
            listingId: productId,
            retainedExistingScreenshotUrls: retainedScreenshotUrls,
            screenshots: await Promise.all(
              values.pendingScreenshotBlobs.map(async (blob) => ({
                mimeType:
                  blob.type && blob.type.startsWith("image/")
                    ? blob.type
                    : "image/png",
                imageBase64: await blobToBase64(blob),
              })),
            ),
          },
        });
      }

      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
      await queryClient.invalidateQueries({
        queryKey: detailQuery.queryKey,
        exact: true,
      });
      void navigate({
        to: "/products/$productId",
        params: { productId: result.slug },
      });
    },
  });

  return (
    <ProductListingForm
      title="Edit listing"
      description="Changes are written to your PDS and mirrored in the directory."
      submitLabel="Save"
      isSubmitting={saveMutation.isPending}
      initialValues={{
        name: listing.name,
        tagline: listing.sourceTagline ?? "",
        fullDescription: listing.sourceFullDescription ?? "",
        externalUrl: listing.externalUrl ?? listing.sourceUrl ?? "",
        productHandle: listing.productAccountHandle ?? "",
        categorySlug: listing.categorySlug ?? "",
        heroImageUrl: listing.heroImageUrl ?? null,
        iconUrl: listing.iconUrl ?? null,
        screenshotUrls: listing.screenshots ?? [],
        links: listing.links ?? [],
        appTags: listing.appTags ?? [],
      }}
      onCancel={() => {
        void navigate({
          to: "/products/$productId",
          params: { productId: productSlug },
        });
      }}
      onSubmit={(values) => saveMutation.mutate(values)}
      errorMessage={
        saveMutation.isError
          ? saveMutation.error instanceof Error
            ? saveMutation.error.message
            : "Could not save."
          : null
      }
    />
  );
}
