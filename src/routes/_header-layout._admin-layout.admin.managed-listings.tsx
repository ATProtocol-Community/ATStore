import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  ProductListingForm,
  type ProductListingFormSubmitValues,
} from "../components/product-listing-form";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import { TextField } from "../design-system/text-field";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { normalizeAppTags, tagsEqual } from "../lib/app-tags";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/managed-listings",
)({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(
      directoryListingApi.getStoreManagedListingsQueryOptions,
    );
  },
  component: AdminManagedListingsPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  pageContent: {
    gap: gap["5xl"],
    maxWidth: "72rem",
    width: "100%",
  },
  header: {
    gap: gap["2xl"],
    maxWidth: "56rem",
  },
  pickerCard: {
    boxShadow: shadow.md,
  },
  pickerBody: {
    gap: gap["xl"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  pickerMeta: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: gap["lg"],
  },
  pickerAvatar: {
    borderRadius: radius.xl,
  },
  devToolsCard: {
    boxShadow: shadow.md,
  },
  devToolsBody: {
    gap: gap["xl"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  devToolsGrid: {
    flexWrap: "wrap",
    gap: gap["lg"],
  },
  devToolsFieldGroup: {
    borderTopStyle: "solid",
    borderTopWidth: 1,
    borderTopColor: uiColor.border2,
    gap: gap["md"],
    paddingTop: verticalSpace["lg"],
  },
  devToolsHelp: {
    color: uiColor.text2,
  },

  imageReviewCard: {
    boxShadow: shadow.lg,
  },
  imageReviewCardBody: {
    gap: gap["2xl"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  imageReviewFigure: {
    alignItems: "center",
    backgroundColor: `color-mix(in srgb, ${uiColor.overlayBackdrop} 8%, transparent)`,
    borderRadius: radius["2xl"],
    display: "flex",
    justifyContent: "center",
    margin: 0,
    maxHeight: "min(42vh, 360px)",
    overflow: "hidden",
    padding: horizontalSpace["2xl"],
  },
  imageReviewHeroImg: {
    borderRadius: radius.xl,
    display: "block",
    height: "auto",
    maxHeight: "min(40vh, 340px)",
    maxWidth: "100%",
    objectFit: "contain",
  },
  imageReviewIconImg: {
    borderRadius: radius["2xl"],
    display: "block",
    height: "auto",
    maxHeight: 192,
    maxWidth: 192,
    objectFit: "contain",
  },
  imageReviewActions: {
    gap: gap["2xl"],
    justifyContent: "flex-end",
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

function AdminManagedListingsPage() {
  const { data: managedListings } = useSuspenseQuery(
    directoryListingApi.getStoreManagedListingsQueryOptions,
  );

  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null,
  );
  const [selectedListingInput, setSelectedListingInput] = useState("");

  const listingItems = useMemo(
    () =>
      managedListings.map((listing) => ({
        id: listing.id,
        label: listing.name,
        slug: listing.slug,
        iconUrl: listing.iconUrl,
        externalUrl: listing.externalUrl,
        handle: listing.productAccountHandle,
        verificationStatus: listing.verificationStatus,
      })),
    [managedListings],
  );

  const selectedSummary = useMemo(
    () =>
      managedListings.find((listing) => listing.id === selectedListingId) ??
      null,
    [managedListings, selectedListingId],
  );

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex direction="column" style={styles.header}>
          <Heading1>Managed listings</Heading1>
          <Body variant="secondary">
            Pick any listing still published from the store account and edit it
            in place.
          </Body>
          <SmallBody variant="secondary">
            {managedListings.length} listing
            {managedListings.length === 1 ? "" : "s"} on the store PDS.
          </SmallBody>
        </Flex>

        <Card style={styles.pickerCard}>
          <Flex direction="column" style={styles.pickerBody}>
            <ComboBox
              label="Select a listing"
              items={listingItems}
              inputValue={selectedListingInput}
              selectedKey={selectedListingId}
              onInputChange={setSelectedListingInput}
              onSelectionChange={(key) => {
                if (key === null) {
                  setSelectedListingId(null);
                  setSelectedListingInput("");
                  return;
                }
                const next = String(key);
                setSelectedListingId(next);
                const match = listingItems.find((item) => item.id === next);
                setSelectedListingInput(match?.label ?? "");
              }}
              placeholder="Start typing a listing name"
              allowsEmptyCollection
            >
              {(item) => (
                <ComboBoxItem id={item.id} textValue={item.label}>
                  {item.label}
                </ComboBoxItem>
              )}
            </ComboBox>
            {selectedSummary ? (
              <Flex style={styles.pickerMeta}>
                <Avatar
                  alt={selectedSummary.name}
                  src={selectedSummary.iconUrl ?? undefined}
                  size="lg"
                  style={styles.pickerAvatar}
                  fallback={selectedSummary.name.slice(0, 2).toUpperCase()}
                />
                <Flex direction="column" gap="xl">
                  <Text weight="semibold">{selectedSummary.name}</Text>
                  <SmallBody variant="secondary">
                    /products/{selectedSummary.slug} ·{" "}
                    {selectedSummary.verificationStatus}
                  </SmallBody>
                </Flex>
              </Flex>
            ) : null}
          </Flex>
        </Card>

        {selectedListingId ? (
          <ManagedListingEditor
            listingId={selectedListingId}
            onClear={() => {
              setSelectedListingId(null);
              setSelectedListingInput("");
            }}
          />
        ) : null}
      </Flex>
    </Page.Root>
  );
}

type ToolbarStatus = { tone: "neutral" | "critical"; text: string };

type ImageReviewDraft = {
  kind: "hero" | "icon";
  mimeType: string;
  imageBase64: string;
  previewSource?: "site_asset" | "model";
};

function ManagedListingEditor({
  listingId,
  onClear,
}: {
  listingId: string;
  onClear: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQueryOptions =
    directoryListingApi.getDirectoryListingDetailQueryOptions(listingId);
  const { data: listing } = useQuery(detailQueryOptions);

  const [pendingGeneration, setPendingGeneration] = useState<
    null | "hero" | "icon" | "tagline" | "description"
  >(null);
  const [pendingImageCommit, setPendingImageCommit] = useState(false);
  const [pendingHeroRemoval, setPendingHeroRemoval] = useState(false);
  const [imageReviewDraft, setImageReviewDraft] =
    useState<null | ImageReviewDraft>(null);
  const [toolbarStatus, setToolbarStatus] = useState<ToolbarStatus | null>(
    null,
  );
  const [pendingMetadataSave, setPendingMetadataSave] = useState<
    null | "category" | "tags"
  >(null);
  const [devCategorySlugDraft, setDevCategorySlugDraft] = useState("");
  const [devAppTagsDraft, setDevAppTagsDraft] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setImageReviewDraft(null);
    setToolbarStatus(null);
    setSaveSuccessMessage(null);
  }, [listingId]);

  useEffect(() => {
    setDevCategorySlugDraft(listing?.categorySlug ?? "");
  }, [listing?.categorySlug]);

  useEffect(() => {
    setDevAppTagsDraft(listing?.appTags?.join(", ") ?? "");
  }, [listing?.appTags]);

  async function invalidateListingCaches() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: detailQueryOptions.queryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey:
          directoryListingApi.getStoreManagedListingsQueryOptions.queryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({ queryKey: ["storeListings"] }),
    ]);
  }

  async function runGeneration(
    action: "hero" | "icon" | "tagline" | "description",
  ) {
    setPendingGeneration(action);
    setToolbarStatus(null);
    try {
      if (action === "hero") {
        const preview =
          await directoryListingApi.previewDirectoryListingHeroImage({
            data: { id: listingId },
          });
        setImageReviewDraft({
          kind: "hero",
          mimeType: preview.mimeType,
          imageBase64: preview.imageBase64,
        });
        setToolbarStatus({
          tone: "neutral",
          text: "Review the hero preview below, then accept or discard.",
        });
      } else if (action === "icon") {
        const preview = await directoryListingApi.previewDirectoryListingIcon({
          data: { id: listingId },
        });
        setImageReviewDraft({
          kind: "icon",
          mimeType: preview.mimeType,
          imageBase64: preview.imageBase64,
          previewSource: preview.previewSource,
        });
        setToolbarStatus({
          tone: "neutral",
          text:
            preview.previewSource === "site_asset"
              ? "Preview from site favicon/logo, refined with Gemini. Accept or discard."
              : "Review the generated icon below, then accept or discard.",
        });
      } else if (action === "tagline") {
        const result =
          await directoryListingApi.regenerateDirectoryListingTagline({
            data: { id: listingId },
          });
        setToolbarStatus({
          tone: "neutral",
          text:
            result.source === "website"
              ? "Generated a new tagline from homepage copy."
              : "Generated a new tagline from homepage context.",
        });
      } else {
        const result =
          await directoryListingApi.regenerateDirectoryListingDescription({
            data: { id: listingId },
          });
        setToolbarStatus({
          tone: "neutral",
          text:
            result.source === "website"
              ? "Generated a new description from homepage copy."
              : "Generated a new description from homepage context.",
        });
      }
      await invalidateListingCaches();
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text: error instanceof Error ? error.message : "Generation failed.",
      });
    } finally {
      setPendingGeneration(null);
    }
  }

  async function removeHero() {
    if (pendingHeroRemoval) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Remove the hero image from "${listing?.name ?? "this listing"}"? The listing will publish with a placeholder hero until you set a new one.`,
      )
    ) {
      return;
    }
    setPendingHeroRemoval(true);
    setToolbarStatus(null);
    try {
      await directoryListingApi.removeStoreManagedListingHero({
        data: { id: listingId },
      });
      setImageReviewDraft(null);
      setToolbarStatus({
        tone: "neutral",
        text: "Removed the hero image and republished the listing with a placeholder.",
      });
      await invalidateListingCaches();
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text: error instanceof Error ? error.message : "Could not remove hero.",
      });
    } finally {
      setPendingHeroRemoval(false);
    }
  }

  async function commitImageReview() {
    if (!imageReviewDraft) return;
    setPendingImageCommit(true);
    setToolbarStatus(null);
    try {
      const { kind, mimeType, imageBase64 } = imageReviewDraft;
      if (kind === "hero") {
        await directoryListingApi.commitDirectoryListingHeroImage({
          data: { id: listingId, mimeType, imageBase64 },
        });
        setToolbarStatus({
          tone: "neutral",
          text: "Published the new hero image to the listing record.",
        });
      } else {
        await directoryListingApi.commitDirectoryListingIcon({
          data: { id: listingId, mimeType, imageBase64 },
        });
        setToolbarStatus({
          tone: "neutral",
          text: "Published the new icon to the listing record.",
        });
      }
      setImageReviewDraft(null);
      await invalidateListingCaches();
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text: error instanceof Error ? error.message : "Publish failed.",
      });
    } finally {
      setPendingImageCommit(false);
    }
  }

  async function saveDevCategory() {
    const nextCategorySlug = devCategorySlugDraft.trim() || null;
    const currentCategorySlug = listing?.categorySlug ?? null;
    if (pendingMetadataSave || nextCategorySlug === currentCategorySlug) {
      return;
    }
    setPendingMetadataSave("category");
    setToolbarStatus(null);
    try {
      await directoryListingApi.updateDirectoryListingCategoryAssignment({
        data: { id: listingId, categorySlug: nextCategorySlug },
      });
      setToolbarStatus({
        tone: "neutral",
        text: nextCategorySlug
          ? `Saved category: ${nextCategorySlug}`
          : "Cleared category assignment (defaults to misc on publish).",
      });
      await invalidateListingCaches();
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text:
          error instanceof Error ? error.message : "Category update failed.",
      });
    } finally {
      setPendingMetadataSave(null);
    }
  }

  async function saveDevAppTags() {
    const normalizedTags = normalizeAppTags(
      devAppTagsDraft
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
    if (
      pendingMetadataSave ||
      tagsEqual(normalizedTags, listing?.appTags ?? [])
    ) {
      return;
    }
    setPendingMetadataSave("tags");
    setToolbarStatus(null);
    try {
      await directoryListingApi.updateDirectoryListingAppTags({
        data: { id: listingId, appTags: normalizedTags },
      });
      setToolbarStatus({
        tone: "neutral",
        text:
          normalizedTags.length > 0
            ? `Saved tags: ${normalizedTags.join(", ")}`
            : "Cleared all app tags.",
      });
      await invalidateListingCaches();
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text: error instanceof Error ? error.message : "Tag update failed.",
      });
    } finally {
      setPendingMetadataSave(null);
    }
  }

  const saveMutation = useMutation({
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

      return directoryListingApi.updateStoreManagedListing({
        data: {
          listingId,
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
          retainedExistingScreenshotUrls: values.retainedScreenshotUrls,
          screenshotImages,
        },
      });
    },
    onSuccess: async () => {
      setSaveSuccessMessage(
        "Saved listing changes and republished to the PDS.",
      );
      await invalidateListingCaches();
    },
    onError: () => {
      setSaveSuccessMessage(null);
    },
  });

  const categoryDirty =
    (devCategorySlugDraft.trim() || null) !== (listing?.categorySlug ?? null);
  const normalizedTagsDraft = normalizeAppTags(
    devAppTagsDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  );
  const tagsDirty = !tagsEqual(normalizedTagsDraft, listing?.appTags ?? []);

  if (!listing) {
    return (
      <Card>
        <Flex direction="column" style={styles.devToolsBody}>
          <Body variant="secondary">Loading listing…</Body>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="5xl">
      <Card>
        <Flex direction="column" style={styles.devToolsBody}>
          <Text size="lg" weight="semibold">
            Dev tools
          </Text>
          <SmallBody variant="secondary">
            Quick generate/preview actions. Each button publishes directly to
            the store PDS when accepted.
          </SmallBody>
          <Flex style={styles.devToolsGrid}>
            <Button
              variant="secondary"
              isPending={pendingGeneration === "icon"}
              isDisabled={
                pendingGeneration !== null || imageReviewDraft !== null
              }
              onPress={() => void runGeneration("icon")}
            >
              Generate icon
            </Button>
            <Button
              variant="secondary"
              isPending={pendingGeneration === "hero"}
              isDisabled={
                pendingGeneration !== null || imageReviewDraft !== null
              }
              onPress={() => void runGeneration("hero")}
            >
              Generate hero image
            </Button>
            <Button
              variant="critical-outline"
              isPending={pendingHeroRemoval}
              isDisabled={
                pendingHeroRemoval ||
                pendingGeneration !== null ||
                imageReviewDraft !== null ||
                !listing.heroImageUrl
              }
              onPress={() => void removeHero()}
            >
              Remove hero
            </Button>
            <Button
              variant="secondary"
              isPending={pendingGeneration === "tagline"}
              isDisabled={pendingGeneration !== null}
              onPress={() => void runGeneration("tagline")}
            >
              Generate tagline
            </Button>
            <Button
              variant="secondary"
              isPending={pendingGeneration === "description"}
              isDisabled={pendingGeneration !== null}
              onPress={() => void runGeneration("description")}
            >
              Generate description
            </Button>
          </Flex>

          {toolbarStatus && (
            <Text
              size="sm"
              variant={
                toolbarStatus?.tone === "critical" ? "critical" : "secondary"
              }
            >
              {toolbarStatus?.text ?? " "}
            </Text>
          )}
        </Flex>
      </Card>

      {imageReviewDraft ? (
        <Card style={styles.imageReviewCard}>
          <Flex direction="column" style={styles.imageReviewCardBody}>
            <Text size="lg" weight="semibold">
              {imageReviewDraft.kind === "hero"
                ? "Review new hero image"
                : "Review new icon"}
            </Text>
            {imageReviewDraft.kind === "icon" &&
            imageReviewDraft.previewSource ? (
              <SmallBody variant="secondary">
                {imageReviewDraft.previewSource === "site_asset"
                  ? "Sourced from site favicon or logo asset, then refined with Gemini."
                  : "Generated from a homepage screenshot."}
              </SmallBody>
            ) : null}
            <figure {...stylex.props(styles.imageReviewFigure)}>
              <img
                alt={
                  imageReviewDraft.kind === "hero"
                    ? "Generated hero preview"
                    : "Generated icon preview"
                }
                src={`data:${imageReviewDraft.mimeType};base64,${imageReviewDraft.imageBase64}`}
                {...stylex.props(
                  imageReviewDraft.kind === "hero"
                    ? styles.imageReviewHeroImg
                    : styles.imageReviewIconImg,
                )}
              />
            </figure>
            <Flex style={styles.imageReviewActions}>
              <Button
                variant="secondary"
                isDisabled={pendingImageCommit}
                onPress={() => {
                  setImageReviewDraft(null);
                  setToolbarStatus(null);
                }}
              >
                Discard
              </Button>
              <Button
                isPending={pendingImageCommit}
                isDisabled={pendingImageCommit}
                onPress={() => void commitImageReview()}
              >
                Publish to listing
              </Button>
            </Flex>
          </Flex>
        </Card>
      ) : null}

      <ProductListingForm
        key={listingId}
        title={`Edit ${listing.name}`}
        description="Writes all fields, images, and screenshots to the store PDS in one publish."
        submitLabel="Save all"
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
        onCancel={onClear}
        onSubmit={(values) => saveMutation.mutate(values)}
        errorMessage={
          saveMutation.isError
            ? saveMutation.error instanceof Error
              ? saveMutation.error.message
              : "Could not save."
            : null
        }
        successMessage={saveSuccessMessage}
      />
    </Flex>
  );
}
