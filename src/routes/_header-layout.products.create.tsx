import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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
import { fontSize, fontWeight } from "../design-system/theme/typography.stylex";
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
  stickyFooterActions: {
    justifyContent: "flex-end",
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
        search: {
          redirect: "/products/create",
        },
      });
    }
  },
  component: CreateProductListingPage,
});

function CreateProductListingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: categoryTree } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryTreeQueryOptions,
  );

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [productHandle, setProductHandle] = useState("");
  const [categoryKind, setCategoryKind] = useState<
    "app" | "app-tool" | "protocol"
  >("app");
  const [appName, setAppName] = useState("");
  const [appCategorySlug, setAppCategorySlug] = useState("");
  const [appCategoryLabel, setAppCategoryLabel] = useState("");
  const [protocolCategory, setProtocolCategory] = useState("");
  const [publishResult, setPublishResult] = useState<{
    slug: string;
    uri: string;
  } | null>(null);

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

  const publishMutation = useMutation({
    mutationFn: async () => {
      return directoryListingApi.createOwnedProductListing({
        data: {
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
      setPublishResult(result);
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    },
  });

  return (
    <HeaderLayout.Page>
      <Page.Root variant="small" style={styles.page}>
        <Form
          onSubmit={() => {
            setPublishResult(null);
            publishMutation.mutate();
          }}
        >
          <Flex direction="column" gap="5xl" style={styles.section}>
            <Heading1>Create listing</Heading1>
            <Text size="base" variant="secondary">
              Publish a new listing record to your PDS. Ingestion will create an
              unverified directory entry shortly after.
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
                    {publishMutation.isError ? (
                      <Text size="sm" variant="critical">
                        {publishMutation.error instanceof Error
                          ? publishMutation.error.message
                          : "Could not publish listing."}
                      </Text>
                    ) : null}
                    {publishResult ? (
                      <Text size="sm" variant="secondary">
                        Published to ATProto ({publishResult.uri}). Ingestion
                        should add your new unverified listing soon.
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
                isDisabled={publishMutation.isPending}
                size="lg"
                onPress={() => {
                  void navigate({ to: "/" });
                }}
              >
                Cancel
              </Button>
              <Button
                size="lg"
                variant="primary"
                isPending={publishMutation.isPending}
                isDisabled={!hasValidCategoryInputs}
                type="submit"
              >
                Publish
              </Button>
            </Flex>
          </Page.StickyFooter>
        </Form>
      </Page.Root>
    </HeaderLayout.Page>
  );
}
