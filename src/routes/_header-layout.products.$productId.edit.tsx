import * as stylex from "@stylexjs/stylex";
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
import { useEffect, useRef, useState } from "react";

import { ImageCropperDialog } from "#/components/image-cropper-dialog";
import { UserHandleAutocomplete } from "#/components/user-handle-autocomplete";
import { Button } from "../design-system/button";
import { Card, CardBody } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
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
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Heading1 } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import {
  getDirectoryListingSlug,
  getLegacyDirectoryListingId,
} from "../lib/directory-listing-slugs";
import { fontSize, fontWeight } from "../design-system/theme/typography.stylex";

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
    gap: gap["3xl"],
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
    height: "96px",
    objectFit: "cover",
    overflow: "hidden",
    width: "96px",
  },
  imageIconRow: {
    alignItems: "center",
    gap: gap["2xl"],
    flexWrap: "wrap",
  },
  hiddenInput: {
    clip: "rect(0, 0, 0, 0)",
    height: 1,
    overflow: "hidden",
    position: "absolute",
    width: 1,
  },
  stickyFooterActions: {
    justifyContent: "flex-end",
  },
});

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
  const { data: categoryTree } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryTreeQueryOptions,
  );

  if (!listing) {
    throw notFound();
  }

  const [name, setName] = useState(listing.name);
  const [tagline, setTagline] = useState(listing.sourceTagline ?? "");
  const [fullDescription, setFullDescription] = useState(
    listing.sourceFullDescription ?? "",
  );
  const [externalUrl, setExternalUrl] = useState(
    listing.externalUrl ?? listing.sourceUrl ?? "",
  );
  const [productHandle, setProductHandle] = useState(
    listing.productAccountHandle ?? "",
  );
  const categoryParts = (listing.categorySlug ?? "").split("/").filter(Boolean);
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

  const heroFileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);
  const [cropKind, setCropKind] = useState<null | "hero" | "icon">(null);
  const [cropSourceBlob, setCropSourceBlob] = useState<Blob | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropSession, setCropSession] = useState(0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return directoryListingApi.updateOwnedProductListing({
        data: {
          listingId: productId,
          name,
          tagline,
          fullDescription,
          externalUrl,
          categorySlug,
          productHandle,
        },
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
      void navigate({
        to: "/products/$productId",
        params: { productId: result.slug },
      });
    },
  });

  const imageMutation = useMutation({
    mutationFn: async ({
      kind,
      blob,
    }: {
      kind: "hero" | "icon";
      blob: Blob;
    }) => {
      const mimeType =
        blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
      const imageBase64 = await blobToBase64(blob);
      return directoryListingApi.updateOwnedProductListingImage({
        data: {
          listingId: productId,
          kind,
          mimeType,
          imageBase64,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
      await queryClient.invalidateQueries({
        queryKey: detailQuery.queryKey,
        exact: true,
      });
    },
  });

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
        <Form onSubmit={() => saveMutation.mutate()}>
          <Flex direction="column" gap="5xl" style={styles.section}>
            <Heading1>Edit listing</Heading1>
            <Text size="base" variant="secondary">
              Changes are written to your PDS and mirrored in the directory.
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
                      <Text size="sm" variant="secondary">
                        Hero (16:9)
                      </Text>
                      <Button
                        variant="secondary"
                        isDisabled={imageMutation.isPending}
                        onPress={() => heroFileRef.current?.click()}
                        size="md"
                      >
                        Change hero
                      </Button>
                    </Flex>
                    {listing.heroImageUrl ? (
                      <img
                        src={listing.heroImageUrl}
                        alt=""
                        {...stylex.props(styles.imagePreviewHero)}
                      />
                    ) : (
                      <div {...stylex.props(styles.imagePreviewHero)} />
                    )}
                    <input
                      ref={heroFileRef}
                      type="file"
                      accept="image/*"
                      {...stylex.props(styles.hiddenInput)}
                      aria-hidden
                      tabIndex={-1}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        onPickFile("hero", f);
                        e.target.value = "";
                      }}
                    />
                  </Flex>
                  <Flex direction="column" style={styles.imageAsset}>
                    <Flex style={styles.imageAssetHeader}>
                      <Text size="sm" variant="secondary">
                        Icon (square)
                      </Text>
                      <Button
                        variant="secondary"
                        isDisabled={imageMutation.isPending}
                        onPress={() => iconFileRef.current?.click()}
                        size="md"
                      >
                        Change icon
                      </Button>
                    </Flex>
                    <Flex style={styles.imageIconRow}>
                      {listing.iconUrl ? (
                        <img
                          src={listing.iconUrl}
                          alt=""
                          {...stylex.props(styles.imagePreviewIcon)}
                        />
                      ) : (
                        <div {...stylex.props(styles.imagePreviewIcon)} />
                      )}
                    </Flex>
                    <input
                      ref={iconFileRef}
                      type="file"
                      accept="image/*"
                      {...stylex.props(styles.hiddenInput)}
                      aria-hidden
                      tabIndex={-1}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        onPickFile("icon", f);
                        e.target.value = "";
                      }}
                    />
                  </Flex>
                  {imageMutation.isError ? (
                    <Text size="sm" variant="critical">
                      {imageMutation.error instanceof Error
                        ? imageMutation.error.message
                        : "Could not update image."}
                    </Text>
                  ) : null}
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
                  try {
                    await imageMutation.mutateAsync({
                      kind: cropKind,
                      blob: cropped,
                    });
                    setCropperOpen(false);
                    setCropSourceBlob(null);
                    setCropKind(null);
                  } catch {
                    /* Error surface via imageMutation.isError */
                  }
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
                    {saveMutation.isError ? (
                      <Text size="sm" variant="critical">
                        {saveMutation.error instanceof Error
                          ? saveMutation.error.message
                          : "Could not save."}
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
                isDisabled={saveMutation.isPending}
                size="lg"
                onPress={() => {
                  void navigate({
                    to: "/products/$productId",
                    params: { productId: productSlug },
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                size="lg"
                variant="primary"
                isPending={saveMutation.isPending}
                isDisabled={!hasValidCategoryInputs}
                type="submit"
              >
                Save
              </Button>
            </Flex>
          </Page.StickyFooter>
        </Form>
      </Page.Root>
    </HeaderLayout.Page>
  );
}
