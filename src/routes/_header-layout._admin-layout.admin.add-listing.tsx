import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import {
  ProductListingForm,
  type ProductListingFormControl,
  type ProductListingFormSubmitValues,
} from "../components/product-listing-form";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
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

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/add-listing",
)({
  component: AdminAddListingPage,
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
  toolsCard: {
    boxShadow: shadow.md,
  },
  toolsBody: {
    gap: gap["xl"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  toolsGrid: {
    flexWrap: "wrap",
    gap: gap["lg"],
  },
  statusRow: {
    minHeight: "1.25rem",
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

type ToolbarStatus = { tone: "neutral" | "critical"; text: string };

type ImageReviewDraft = {
  kind: "hero" | "icon";
  mimeType: string;
  imageBase64: string;
  previewSource?: "site_asset" | "model";
};

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

function base64ToBlob(imageBase64: string, mimeType: string): Blob {
  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function AdminAddListingPage() {
  const navigate = useNavigate();
  const formControlRef = useRef<ProductListingFormControl>(null);

  const [generationName, setGenerationName] = useState("");
  const [generationUrl, setGenerationUrl] = useState("");
  const [pendingGeneration, setPendingGeneration] = useState<
    null | "hero" | "icon"
  >(null);
  const [imageReviewDraft, setImageReviewDraft] =
    useState<null | ImageReviewDraft>(null);
  const [toolbarStatus, setToolbarStatus] = useState<ToolbarStatus | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function runGeneration(kind: "hero" | "icon") {
    const name = generationName.trim();
    const externalUrl = generationUrl.trim();
    if (!name || !externalUrl) {
      setToolbarStatus({
        tone: "critical",
        text: "Enter a name and URL before generating images.",
      });
      return;
    }

    setPendingGeneration(kind);
    setToolbarStatus(null);
    try {
      if (kind === "hero") {
        const preview = await directoryListingApi.previewListingHeroImageByUrl({
          data: { name, externalUrl },
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
      } else {
        const preview = await directoryListingApi.previewListingIconByUrl({
          data: { name, externalUrl },
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
      }
    } catch (error) {
      setToolbarStatus({
        tone: "critical",
        text: error instanceof Error ? error.message : "Generation failed.",
      });
    } finally {
      setPendingGeneration(null);
    }
  }

  function acceptImageReview() {
    if (!imageReviewDraft) return;
    const blob = base64ToBlob(
      imageReviewDraft.imageBase64,
      imageReviewDraft.mimeType,
    );
    if (imageReviewDraft.kind === "hero") {
      formControlRef.current?.setPendingHero(blob);
      setToolbarStatus({
        tone: "neutral",
        text: "Hero image staged. Submit the form to publish to the store PDS.",
      });
    } else {
      formControlRef.current?.setPendingIcon(blob);
      setToolbarStatus({
        tone: "neutral",
        text: "Icon staged. Submit the form to publish to the store PDS.",
      });
    }
    setImageReviewDraft(null);
  }

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
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex direction="column" style={styles.header}>
          <Heading1>Add listing</Heading1>
          <Body variant="secondary">
            Create a brand-new listing on the store PDS (
            <code>atproto.fyi</code>). Tap ingest picks up the record and
            imports it into the directory once it lands.
          </Body>
          <SmallBody variant="secondary">
            Name and URL also seed the hero/icon generators below.
          </SmallBody>
        </Flex>

        <Card style={styles.toolsCard}>
          <Flex direction="column" style={styles.toolsBody}>
            <Text size="lg" weight="semibold">
              Generate hero / icon from URL
            </Text>
            <SmallBody variant="secondary">
              Enter the product name and homepage URL, then generate and accept
              a preview. Accepted images are staged in the form below and
              published on submit.
            </SmallBody>
            <TextField
              label="Product name"
              value={generationName}
              onChange={setGenerationName}
              placeholder="Bluesky"
            />
            <TextField
              label="Homepage URL"
              value={generationUrl}
              onChange={setGenerationUrl}
              placeholder="https://bsky.app"
            />
            <Flex style={styles.toolsGrid}>
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
            </Flex>
            <Text
              size="sm"
              variant={
                toolbarStatus?.tone === "critical" ? "critical" : "secondary"
              }
              style={styles.statusRow}
            >
              {toolbarStatus?.text ?? " "}
            </Text>
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
                  onPress={() => {
                    setImageReviewDraft(null);
                    setToolbarStatus(null);
                  }}
                >
                  Discard
                </Button>
                <Button onPress={acceptImageReview}>Use this image</Button>
              </Flex>
            </Flex>
          </Card>
        ) : null}

        <ProductListingForm
          controlRef={formControlRef}
          title="New listing"
          description="Fields below publish a new fyi.atstore.listing.detail record to the store PDS."
          submitLabel="Publish to store PDS"
          isSubmitting={createMutation.isPending}
          initialValues={{
            name: generationName,
            tagline: "",
            fullDescription: "",
            externalUrl: generationUrl,
            productHandle: "",
            categorySlug: "",
            heroImageUrl: null,
            iconUrl: null,
            screenshotUrls: [],
            links: [],
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
      </Flex>
    </Page.Root>
  );
}
