import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import type { ProductListingFormSubmitValues } from "../components/product-listing-form";

import { ProductListingForm } from "../components/product-listing-form";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
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
import { blobToBase64 } from "../lib/blob-to-base64";

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
    gap: gap["lg"],
    alignItems: "center",
    flexWrap: "wrap",
  },
  pickerAvatar: {
    borderRadius: radius.xl,
  },
  devToolsBody: {
    gap: gap["xl"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  devToolsGrid: {
    gap: gap["lg"],
    flexWrap: "wrap",
  },
  dangerZone: {
    gap: gap["md"],
    borderTopColor: uiColor.border2,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    paddingTop: verticalSpace["lg"],
  },
});

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
    null | "tagline" | "description"
  >(null);
  const [pendingListingDeletion, setPendingListingDeletion] = useState(false);
  const [toolbarStatus, setToolbarStatus] = useState<ToolbarStatus | null>(
    null,
  );
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setToolbarStatus(null);
    setSaveSuccessMessage(null);
  }, [listingId]);

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

  async function runGeneration(action: "tagline" | "description") {
    setPendingGeneration(action);
    setToolbarStatus(null);
    try {
      if (action === "tagline") {
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

  async function deleteListing() {
    if (pendingListingDeletion) return;
    if (
      globalThis.window !== undefined &&
      !globalThis.window.confirm(
        `Permanently delete "${listing?.name ?? "this listing"}"? This tombstones the record on the store PDS and removes it from the directory immediately. This cannot be undone.`,
      )
    ) {
      return;
    }
    setPendingListingDeletion(true);
    setToolbarStatus(null);
    try {
      await directoryListingApi.deleteStoreManagedListing({
        data: { id: listingId },
      });
      await invalidateListingCaches();
      onClear();
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text:
          error instanceof Error ? error.message : "Could not delete listing.",
      });
      setPendingListingDeletion(false);
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
            Regenerate tagline or description from the listing URL (copy only —
            images are edited in the form below).
          </SmallBody>
          <Flex style={styles.devToolsGrid}>
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

          <Flex direction="column" style={styles.dangerZone}>
            <Text size="sm" weight="semibold">
              Danger zone
            </Text>
            <SmallBody variant="secondary">
              Tombstones the record on the store PDS and removes the listing
              from the directory. This cannot be undone.
            </SmallBody>
            <Flex>
              <Button
                variant="critical-outline"
                isPending={pendingListingDeletion}
                isDisabled={
                  pendingListingDeletion ||
                  pendingGeneration !== null ||
                  saveMutation.isPending
                }
                onPress={() => void deleteListing()}
              >
                Delete listing
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Card>

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
        requireHero={false}
      />
    </Flex>
  );
}
