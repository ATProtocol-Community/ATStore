import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { ImageCropperDialog } from "#/components/image-cropper-dialog";
import { UserHandleAutocomplete } from "#/components/user-handle-autocomplete";
import { Button } from "../design-system/button";
import { Card, CardBody } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import {
  FileDropDefaultTrigger,
  FileDropZone,
} from "../design-system/file-drop-zone";
import { Flex } from "../design-system/flex";
import { Form } from "../design-system/form";
import { HeaderLayout } from "../design-system/header-layout";
import { Page } from "../design-system/page";
import { Select, SelectItem } from "../design-system/select";
import { TextArea } from "../design-system/text-area";
import { TextField } from "../design-system/text-field";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontSize, fontWeight } from "../design-system/theme/typography.stylex";
import { Heading1 } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";

type CategoryTreeNode = {
  id: string;
  pathIds?: string[];
  pathLabels?: string[];
  children?: CategoryTreeNode[];
};

type ProtocolCategoryOption = {
  id: string;
  label: string;
};

type AppCategoryOptionsByApp = Record<string, ProtocolCategoryOption[]>;
type AppSlugOption = {
  id: string;
  label: string;
};

function collectProtocolCategoryOptions(
  nodes: CategoryTreeNode[],
): ProtocolCategoryOption[] {
  const seen = new Set<string>();
  const out: ProtocolCategoryOption[] = [];

  const walk = (node: CategoryTreeNode) => {
    const pathIds = node.pathIds ?? node.id.split("/").filter(Boolean);
    const pathLabels = node.pathLabels ?? [];
    if (pathIds[0] === "protocol" && pathIds.length === 2) {
      const id = pathIds[1]?.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push({ id, label: pathLabels[1] ?? id });
      }
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function collectAppCategoryOptionsByApp(
  nodes: CategoryTreeNode[],
): AppCategoryOptionsByApp {
  const byApp = new Map<string, Map<string, string>>();

  const walk = (node: CategoryTreeNode) => {
    const pathIds = node.pathIds ?? node.id.split("/").filter(Boolean);
    const pathLabels = node.pathLabels ?? [];
    if (pathIds[0] === "apps" && pathIds.length === 3) {
      const appSlug = pathIds[1]?.trim();
      const categorySlug = pathIds[2]?.trim();
      if (appSlug && categorySlug) {
        if (!byApp.has(appSlug)) {
          byApp.set(appSlug, new Map());
        }
        byApp.get(appSlug)?.set(categorySlug, pathLabels[2] ?? categorySlug);
      }
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return Object.fromEntries(
    [...byApp.entries()].map(([appSlug, categories]) => [
      appSlug,
      [...categories.entries()]
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ]),
  );
}

function collectAppSlugOptions(nodes: CategoryTreeNode[]): AppSlugOption[] {
  const seen = new Set<string>();
  const out: AppSlugOption[] = [];

  const walk = (node: CategoryTreeNode) => {
    const pathIds = node.pathIds ?? node.id.split("/").filter(Boolean);
    const pathLabels = node.pathLabels ?? [];
    if (pathIds[0] === "apps" && pathIds.length >= 2) {
      const appSlug = pathIds[1]?.trim();
      if (appSlug && !seen.has(appSlug)) {
        seen.add(appSlug);
        out.push({ id: appSlug, label: pathLabels[1] ?? appSlug });
      }
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };

  for (const node of nodes) {
    walk(node);
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function toKebabCaseSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const styles = stylex.create({
  emptyStateMessage: {
    color: uiColor.text1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: "center",
    paddingTop: verticalSpace.xl,
    paddingBottom: verticalSpace.xl,
    paddingLeft: horizontalSpace.md,
    paddingRight: horizontalSpace.md,
  },
  grow: {
    flexGrow: 1,
  },
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
  card: {
    boxShadow: shadow.sm,
    width: "100%",
  },
  form: {
    gap: gap["3xl"],
  },
  imageSection: {
    gap: gap["2xl"],
  },
  imageAsset: {
    gap: gap["xl"],
  },
  imageAssetHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: gap["md"],
  },
  requiredLabel: {
    alignItems: "center",
    gap: gap.xs,
  },
  imagePreviewHero: {
    aspectRatio: "16 / 9",
    backgroundColor: uiColor.overlayBackdrop,
    borderColor: uiColor.border1,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    objectFit: "cover",
    overflow: "hidden",
    width: "100%",
  },
  imagePreviewIcon: {
    backgroundColor: uiColor.overlayBackdrop,
    borderColor: uiColor.border1,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    height: size["8xl"],
    objectFit: "cover",
    overflow: "hidden",
    width: size["8xl"],
  },
  imageIconRow: {
    alignItems: "center",
    gap: gap["2xl"],
    flexWrap: "wrap",
  },
  imageDropZone: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
  },
  imageDropZoneHero: {
    aspectRatio: "16 / 9",
    padding: 0,
  },
  imageDropZoneIcon: {
    aspectRatio: "1 / 1",
    padding: 0,
    alignSelf: "flex-start",
    width: size["9xl"],
  },
  stickyFooterActions: {
    justifyContent: "flex-end",
  },
});

export type ProductListingFormSubmitValues = {
  name: string;
  tagline: string;
  fullDescription: string;
  externalUrl: string;
  productHandle: string;
  categorySlug: string;
  pendingHeroBlob: Blob | null;
  pendingIconBlob: Blob | null;
};

export type ProductListingFormInitialValues = {
  name: string;
  tagline: string;
  fullDescription: string;
  externalUrl: string;
  productHandle: string;
  categorySlug: string;
  heroImageUrl?: string | null;
  iconUrl?: string | null;
};

type ProductListingFormProps = {
  title: string;
  description: string;
  submitLabel: string;
  isSubmitting: boolean;
  initialValues: ProductListingFormInitialValues;
  onSubmit: (values: ProductListingFormSubmitValues) => void;
  onCancel: () => void;
  errorMessage?: string | null;
  successMessage?: string | null;
};

export function ProductListingForm({
  title,
  description,
  submitLabel,
  isSubmitting,
  initialValues,
  onSubmit,
  onCancel,
  errorMessage,
  successMessage,
}: ProductListingFormProps) {
  const { data: categoryTree } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryTreeQueryOptions,
  );

  const [name, setName] = useState(initialValues.name);
  const [tagline, setTagline] = useState(initialValues.tagline);
  const [fullDescription, setFullDescription] = useState(
    initialValues.fullDescription,
  );
  const [externalUrl, setExternalUrl] = useState(initialValues.externalUrl);
  const [productHandle, setProductHandle] = useState(
    initialValues.productHandle,
  );

  const categoryParts = (initialValues.categorySlug ?? "")
    .split("/")
    .filter(Boolean);
  const [categoryKind, setCategoryKind] = useState<
    "app" | "app-tool" | "protocol"
  >(
    categoryParts[0] === "protocol"
      ? "protocol"
      : categoryParts.length >= 3
        ? "app-tool"
        : "app",
  );
  const [appName, setAppName] = useState(
    categoryParts[0] === "apps" ? (categoryParts[1] ?? "") : "",
  );
  const [appCategorySlug, setAppCategorySlug] = useState(
    categoryParts[0] === "apps" ? (categoryParts[2] ?? "") : "",
  );
  const [appCategoryLabel, setAppCategoryLabel] = useState(
    categoryParts[0] === "apps" ? (categoryParts[2] ?? "") : "",
  );
  const [protocolCategory, setProtocolCategory] = useState(
    categoryParts[0] === "protocol" ? (categoryParts[1] ?? "") : "",
  );

  const appCategoryOptionsByApp = collectAppCategoryOptionsByApp(
    (categoryTree ?? []) as CategoryTreeNode[],
  );
  const appSlugOptions = collectAppSlugOptions(
    (categoryTree ?? []) as CategoryTreeNode[],
  );
  const appSlugKey = appName.trim().toLowerCase();
  const selectedAppSlugOption =
    appSlugOptions.find((option) => option.id === appSlugKey)?.id ?? null;
  const appCategoryOptions = appCategoryOptionsByApp[appSlugKey] ?? [];
  const selectedAppCategoryOption =
    appCategoryOptions.find((option) => option.id === appCategorySlug)?.id ??
    null;
  const isCustomAppCategory =
    categoryKind === "app-tool" &&
    appCategorySlug.trim().length > 0 &&
    !appCategoryOptions.some((option) => option.id === appCategorySlug);
  useEffect(() => {
    if (categoryKind !== "app-tool") return;
    const match = appCategoryOptions.find(
      (option) => option.id === appCategorySlug,
    );
    if (!match) return;
    if (
      appCategoryLabel.trim() === "" ||
      appCategoryLabel.trim() === appCategorySlug
    ) {
      setAppCategoryLabel(match.label);
    }
  }, [categoryKind, appCategoryOptions, appCategorySlug, appCategoryLabel]);

  const protocolCategoryOptions = collectProtocolCategoryOptions(
    (categoryTree ?? []) as CategoryTreeNode[],
  );
  const selectedProtocolCategoryOption =
    protocolCategoryOptions.find((option) => option.id === protocolCategory)
      ?.id ?? null;
  const isCustomProtocolCategory =
    categoryKind === "protocol" &&
    protocolCategory.trim().length > 0 &&
    !protocolCategoryOptions.some((option) => option.id === protocolCategory);
  const categorySlug =
    categoryKind === "protocol"
      ? `protocol/${protocolCategory.trim()}`
      : categoryKind === "app-tool" && appCategorySlug.trim().length > 0
        ? `apps/${appName.trim()}/${appCategorySlug.trim()}`
        : `apps/${appName.trim()}`;
  const hasValidCategoryInputs =
    categoryKind === "protocol"
      ? protocolCategory.trim().length > 0
      : categoryKind === "app-tool"
        ? appName.trim().length > 0 && appCategorySlug.trim().length > 0
        : appName.trim().length > 0;

  const [cropKind, setCropKind] = useState<null | "hero" | "icon">(null);
  const [cropSourceBlob, setCropSourceBlob] = useState<Blob | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropSession, setCropSession] = useState(0);
  const pendingHeroBlobRef = useRef<Blob | null>(null);
  const [pendingHeroPreviewUrl, setPendingHeroPreviewUrl] = useState<
    string | null
  >(null);
  const pendingIconBlobRef = useRef<Blob | null>(null);
  const [pendingIconPreviewUrl, setPendingIconPreviewUrl] = useState<
    string | null
  >(null);
  const hasHeroImage = Boolean(
    pendingHeroPreviewUrl || initialValues.heroImageUrl,
  );
  const hasIconImage = Boolean(pendingIconPreviewUrl || initialValues.iconUrl);
  const hasRequiredImages = hasHeroImage && hasIconImage;

  useEffect(() => {
    return () => {
      if (pendingHeroPreviewUrl) {
        URL.revokeObjectURL(pendingHeroPreviewUrl);
      }
    };
  }, [pendingHeroPreviewUrl]);

  useEffect(() => {
    return () => {
      if (pendingIconPreviewUrl) {
        URL.revokeObjectURL(pendingIconPreviewUrl);
      }
    };
  }, [pendingIconPreviewUrl]);

  function onPickFile(kind: "hero" | "icon", file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    setCropSession((n) => n + 1);
    setCropKind(kind);
    setCropSourceBlob(file);
    setCropperOpen(true);
  }

  return (
    <HeaderLayout.Page>
      <Page.Root variant="small" style={styles.page}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name,
              tagline,
              fullDescription,
              externalUrl,
              productHandle,
              categorySlug,
              pendingHeroBlob: pendingHeroBlobRef.current,
              pendingIconBlob: pendingIconBlobRef.current,
            });
          }}
        >
          <Flex direction="column" gap="5xl" style={styles.section}>
            <Heading1>{title}</Heading1>
            <Text size="base" variant="secondary">
              {description}
            </Text>

            <Card style={styles.card} size="lg">
              <CardBody>
                <Flex direction="column" gap="4xl">
                  <Text weight="semibold" size="lg">
                    Categorization
                  </Text>
                  <Flex wrap align="center" gap="xl">
                    <Select
                      label="Type"
                      items={[
                        { id: "app", label: "App" },
                        { id: "app-tool", label: "App Tool" },
                        { id: "protocol", label: "Protocol Tool" },
                      ]}
                      placeholder="Select type"
                      value={categoryKind}
                      onChange={(value) => {
                        if (
                          value === "app" ||
                          value === "app-tool" ||
                          value === "protocol"
                        ) {
                          setCategoryKind(value);
                        }
                      }}
                      isRequired
                      style={styles.grow}
                    >
                      {(item) => <SelectItem>{item.label}</SelectItem>}
                    </Select>
                    {categoryKind === "app" || categoryKind === "app-tool" ? (
                      <>
                        {categoryKind === "app" ? (
                          <TextField
                            style={styles.grow}
                            label="App Slug"
                            value={appName}
                            onChange={setAppName}
                            placeholder="bluesky"
                            isRequired
                          />
                        ) : (
                          <Select
                            style={styles.grow}
                            label="App"
                            items={appSlugOptions}
                            placeholder="Select app"
                            value={selectedAppSlugOption}
                            onChange={(value) => {
                              if (typeof value !== "string") return;
                              setAppName(value);
                            }}
                            isRequired
                          >
                            {(item) => <SelectItem>{item.label}</SelectItem>}
                          </Select>
                        )}
                        {categoryKind === "app-tool" ? (
                          <ComboBox
                            allowsCustomValue
                            allowsEmptyCollection
                            style={styles.grow}
                            label="Category"
                            items={appCategoryOptions}
                            renderEmptyState={() => (
                              <div {...stylex.props(styles.emptyStateMessage)}>
                                {appSlugKey
                                  ? "No defined categories for this app yet."
                                  : "Type an app slug to see known categories."}
                              </div>
                            )}
                            inputValue={appCategoryLabel}
                            value={selectedAppCategoryOption}
                            onInputChange={(value) => {
                              setAppCategoryLabel(value);
                              setAppCategorySlug(toKebabCaseSegment(value));
                            }}
                            onChange={(key) => {
                              if (key === null) return;
                              const nextSlug = String(key);
                              const nextLabel =
                                appCategoryOptions.find(
                                  (option) => option.id === nextSlug,
                                )?.label ?? nextSlug;
                              setAppCategorySlug(nextSlug);
                              setAppCategoryLabel(nextLabel);
                            }}
                            placeholder="clients"
                            isRequired
                          >
                            {(item) => (
                              <ComboBoxItem id={item.id}>
                                {item.label}
                              </ComboBoxItem>
                            )}
                          </ComboBox>
                        ) : null}
                      </>
                    ) : (
                      <ComboBox
                        allowsCustomValue
                        style={styles.grow}
                        label="Category"
                        items={protocolCategoryOptions}
                        inputValue={protocolCategory}
                        selectedKey={selectedProtocolCategoryOption}
                        onInputChange={setProtocolCategory}
                        onSelectionChange={(key) => {
                          if (key === null) return;
                          setProtocolCategory(String(key));
                        }}
                        placeholder="PDS"
                        isRequired
                      >
                        {(item) => (
                          <ComboBoxItem id={item.id}>{item.label}</ComboBoxItem>
                        )}
                      </ComboBox>
                    )}
                  </Flex>
                  {categoryKind === "app-tool" ? (
                    <Flex direction="column" gap="xl">
                      <Text size="sm" variant="secondary">
                        Saved as{" "}
                        <code>
                          apps/{appName || "<app>"}/
                          {appCategorySlug || "<category>"}
                        </code>
                      </Text>
                      {isCustomAppCategory ? (
                        <Text size="sm" variant="critical">
                          New category detected. Please try to stick to defined
                          categories when possible.
                        </Text>
                      ) : null}
                    </Flex>
                  ) : categoryKind === "app" ? (
                    <Text size="sm" variant="secondary">
                      Saved as <code>apps/{appName || "<app>"}</code>
                    </Text>
                  ) : (
                    <Flex direction="column" gap="xl">
                      <Text size="sm" variant="secondary">
                        Saved in group{" "}
                        <code>protocol/{protocolCategory || "<category>"}</code>
                      </Text>
                      {isCustomProtocolCategory ? (
                        <Text size="sm" variant="critical">
                          New category detected. Please try to stick to defined
                          categories when possible.
                        </Text>
                      ) : null}
                    </Flex>
                  )}
                </Flex>
              </CardBody>
            </Card>

            <Card style={styles.card} size="lg">
              <CardBody>
                <Flex direction="column" gap="2xl" style={styles.imageSection}>
                  <Text weight="semibold" size="lg">
                    Images
                  </Text>
                  <Flex direction="column" style={styles.imageAsset}>
                    <Flex style={styles.imageAssetHeader}>
                      <Flex style={styles.requiredLabel}>
                        <Text size="sm" variant="secondary">
                          Hero (16:9)
                        </Text>
                        <Text size="sm" variant="critical">
                          *
                        </Text>
                      </Flex>
                    </Flex>
                    <FileDropZone
                      acceptedFileTypes={["image/*"]}
                      isDisabled={isSubmitting}
                      onAddFiles={(files) => {
                        onPickFile("hero", files[0]);
                      }}
                      style={[styles.imageDropZone, styles.imageDropZoneHero]}
                    >
                      {pendingHeroPreviewUrl || initialValues.heroImageUrl ? (
                        <img
                          src={
                            pendingHeroPreviewUrl ??
                            initialValues.heroImageUrl ??
                            ""
                          }
                          alt=""
                          {...stylex.props(styles.imagePreviewHero)}
                        />
                      ) : (
                        <div {...stylex.props(styles.imagePreviewHero)} />
                      )}
                      <FileDropDefaultTrigger aria-label="Select hero image">
                        Change hero
                      </FileDropDefaultTrigger>
                    </FileDropZone>
                  </Flex>
                  <Flex direction="column" style={styles.imageAsset}>
                    <Flex style={styles.imageAssetHeader}>
                      <Flex style={styles.requiredLabel}>
                        <Text size="sm" variant="secondary">
                          Icon (square)
                        </Text>
                        <Text size="sm" variant="critical">
                          *
                        </Text>
                      </Flex>
                    </Flex>
                    <FileDropZone
                      acceptedFileTypes={["image/*"]}
                      isDisabled={isSubmitting}
                      onAddFiles={(files) => {
                        onPickFile("icon", files[0]);
                      }}
                      style={[styles.imageDropZone, styles.imageDropZoneIcon]}
                    >
                      <Flex style={styles.imageIconRow}>
                        {pendingIconPreviewUrl || initialValues.iconUrl ? (
                          <img
                            src={
                              pendingIconPreviewUrl ??
                              initialValues.iconUrl ??
                              ""
                            }
                            alt=""
                            {...stylex.props(styles.imagePreviewIcon)}
                          />
                        ) : (
                          <div {...stylex.props(styles.imagePreviewIcon)} />
                        )}
                      </Flex>
                      <FileDropDefaultTrigger aria-label="Select icon image">
                        Change icon
                      </FileDropDefaultTrigger>
                    </FileDropZone>
                  </Flex>
                </Flex>
              </CardBody>
            </Card>

            {cropSourceBlob && cropKind ? (
              <ImageCropperDialog
                key={`${String(cropSession)}-${cropKind}`}
                image={cropSourceBlob}
                aspectRatio={cropKind === "hero" ? 16 / 9 : 1}
                title={cropKind === "hero" ? "Crop hero image" : "Crop icon"}
                description="Drag to reposition, use the slider to zoom, then save."
                isOpen={cropperOpen}
                onOpenChange={(open) => {
                  setCropperOpen(open);
                  if (!open) {
                    setCropSourceBlob(null);
                    setCropKind(null);
                  }
                }}
                onSubmit={async (cropped) => {
                  const nextPreviewUrl = URL.createObjectURL(cropped);
                  if (cropKind === "hero") {
                    if (pendingHeroPreviewUrl) {
                      URL.revokeObjectURL(pendingHeroPreviewUrl);
                    }
                    pendingHeroBlobRef.current = cropped;
                    setPendingHeroPreviewUrl(nextPreviewUrl);
                  } else {
                    if (pendingIconPreviewUrl) {
                      URL.revokeObjectURL(pendingIconPreviewUrl);
                    }
                    pendingIconBlobRef.current = cropped;
                    setPendingIconPreviewUrl(nextPreviewUrl);
                  }
                  setCropperOpen(false);
                  setCropSourceBlob(null);
                  setCropKind(null);
                }}
              />
            ) : null}

            <Card style={styles.card} size="lg">
              <CardBody>
                <Flex direction="column" gap="4xl">
                  <Text weight="semibold" size="lg">
                    Listing Details
                  </Text>
                  <Flex direction="column" style={styles.form}>
                    <TextField
                      label="Name"
                      value={name}
                      onChange={setName}
                      isRequired
                    />
                    <UserHandleAutocomplete
                      label="Product handle"
                      value={productHandle}
                      onValueChange={setProductHandle}
                      placeholder="your.handle.com"
                      size="lg"
                    />
                    <TextField
                      label="Tagline"
                      value={tagline}
                      onChange={setTagline}
                      isRequired
                    />
                    <TextField
                      label="Primary URL"
                      value={externalUrl}
                      onChange={setExternalUrl}
                      isRequired
                    />
                    <TextArea
                      label="Description"
                      value={fullDescription}
                      onChange={setFullDescription}
                      rows={10}
                    />
                    {errorMessage ? (
                      <Text size="sm" variant="critical">
                        {errorMessage}
                      </Text>
                    ) : null}
                    {successMessage ? (
                      <Text size="sm" variant="secondary">
                        {successMessage}
                      </Text>
                    ) : null}
                  </Flex>
                </Flex>
              </CardBody>
            </Card>
          </Flex>
          <Page.StickyFooter>
            <Flex gap="md" wrap style={styles.stickyFooterActions}>
              <Button
                variant="secondary"
                isDisabled={isSubmitting}
                size="lg"
                onPress={onCancel}
              >
                Cancel
              </Button>
              <Button
                size="lg"
                variant="primary"
                isPending={isSubmitting}
                isDisabled={!hasValidCategoryInputs || !hasRequiredImages}
                type="submit"
              >
                {submitLabel}
              </Button>
            </Flex>
          </Page.StickyFooter>
        </Form>
      </Page.Root>
    </HeaderLayout.Page>
  );
}
