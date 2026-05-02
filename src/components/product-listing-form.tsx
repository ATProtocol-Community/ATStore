import type {
  ListingLink,
  ListingLinkType,
} from "#/lib/atproto/listing-record";
import type { DropTarget } from "react-aria-components";

import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ImageCropperDialog } from "#/components/image-cropper-dialog";
import { UserHandleAutocomplete } from "#/components/user-handle-autocomplete";
import { formatAppTagLabel } from "#/lib/app-tag-metadata";
import {
  MAX_APP_TAGS_PER_LISTING,
  normalizeAppTag,
  normalizeAppTags,
} from "#/lib/app-tags";
import {
  LISTING_LINK_MAX_COUNT,
  LISTING_LINK_TYPES,
} from "#/lib/atproto/listing-record";
import { GripVertical, Info, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button as AriaButton,
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
} from "react-aria-components";

import { Alert } from "../design-system/alert";
import { Button } from "../design-system/button";
import { Card, CardBody } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import {
  FileDropDefaultTrigger,
  FileDropZone,
} from "../design-system/file-drop-zone";
import { Flex } from "../design-system/flex";
import { Form } from "../design-system/form";
import { IconButton } from "../design-system/icon-button";
import { Page } from "../design-system/page";
import { Popover } from "../design-system/popover";
import { Select, SelectItem } from "../design-system/select";
import { Separator } from "../design-system/separator";
import { TextArea } from "../design-system/text-area";
import { TextField } from "../design-system/text-field";
import { primaryColor, uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { fontSize, fontWeight } from "../design-system/theme/typography.stylex";
import { ToggleButton } from "../design-system/toggle-button";
import { Heading1, ListItem, UnorderedList } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";

type CategoryTreeNode = {
  id: string;
  pathIds?: Array<string>;
  pathLabels?: Array<string>;
  children?: Array<CategoryTreeNode>;
};

type ProtocolCategoryOption = {
  id: string;
  label: string;
};

type AppCategoryOptionsByApp = Record<string, Array<ProtocolCategoryOption>>;
type AppSlugOption = {
  id: string;
  label: string;
};

type ScreenshotItem = {
  id: string;
  previewUrl: string;
  blob: Blob | null;
};

type LinkRow = {
  /** Local-only id so React can track the row across reorders/removals. */
  id: string;
  type: string;
  url: string;
  label: string;
};

const MAX_SCREENSHOT_COUNT = 4;

const LINK_TYPE_OPTIONS: Array<{ id: ListingLinkType; label: string }> = [
  { id: "support", label: "Support" },
  { id: "contact", label: "Contact" },
  { id: "docs", label: "Documentation" },
  { id: "blog", label: "Blog" },
  { id: "changelog", label: "Changelog" },
  { id: "source", label: "Source code" },
  { id: "status", label: "Status page" },
  { id: "other", label: "Other" },
];

const LINK_TYPE_SET = new Set<string>(LISTING_LINK_TYPES);

function createLinkRowId(): string {
  return `link-${crypto.randomUUID()}`;
}

function toLinkRow(link: ListingLink): LinkRow {
  const type = LINK_TYPE_SET.has(link.type) ? link.type : "other";
  return {
    id: createLinkRowId(),
    type,
    url: link.url ?? "",
    label: link.label ?? "",
  };
}

/**
 * Seed the editor with empty policy-link rows when the listing has none yet so owners
 * are nudged to fill them in. Blank URLs are filtered out in `collectLinksForSubmit`,
 * so leaving them empty is a no-op on save.
 */
const DEFAULT_SEEDED_LINK_TYPES: Array<ListingLinkType> = ["privacy", "terms"];

function buildInitialLinkRows(
  initialLinks: ListingLink[] | undefined,
): Array<LinkRow> {
  const existing = (initialLinks ?? [])
    .slice(0, LISTING_LINK_MAX_COUNT)
    .map((row) => toLinkRow(row));
  if (existing.length > 0) return existing;
  return DEFAULT_SEEDED_LINK_TYPES.map((type) => ({
    id: createLinkRowId(),
    type,
    url: "",
    label: "",
  }));
}

function reorderScreenshotItems(
  items: Array<ScreenshotItem>,
  movedKeys: Set<React.Key>,
  target: DropTarget,
): Array<ScreenshotItem> {
  if (target.type !== "item") {
    return items;
  }
  const movingIds = new Set([...movedKeys].map(String));
  const movingItems = items.filter((item) => movingIds.has(item.id));
  if (movingItems.length === 0) {
    return items;
  }
  const remainingItems = items.filter((item) => !movingIds.has(item.id));
  const targetIndex = remainingItems.findIndex(
    (item) => item.id === String(target.key),
  );
  if (targetIndex === -1) {
    return items;
  }
  const insertIndex =
    target.dropPosition === "after" ? targetIndex + 1 : targetIndex;
  return [
    ...remainingItems.slice(0, insertIndex),
    ...movingItems,
    ...remainingItems.slice(insertIndex),
  ];
}

function collectAppCategoryOptionsByApp(
  nodes: Array<CategoryTreeNode>,
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
        .toSorted((a, b) => a.label.localeCompare(b.label)),
    ]),
  );
}

function collectAppSlugOptions(
  nodes: Array<CategoryTreeNode>,
): Array<AppSlugOption> {
  const seen = new Set<string>();
  const out: Array<AppSlugOption> = [];

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

  return out.toSorted((a, b) => a.label.localeCompare(b.label));
}

function toKebabCaseSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

const styles = stylex.create({
  screenshotPreviewActionButton: {
    borderWidth: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    // Let pointer events reach the draggable row (GridListItem); grip is for keyboard a11y.
    pointerEvents: "none",
    height: size["4xl"],
    paddingBottom: verticalSpace.xs,
    paddingLeft: horizontalSpace.sm,
    paddingRight: horizontalSpace.sm,
    paddingTop: verticalSpace.xs,
    width: size["4xl"],
  },
  list: {
    columnGap: 0,
    rowGap: 0,
  },
  emptyStateMessage: {
    color: uiColor.text1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: "center",
    paddingBottom: verticalSpace.xl,
    paddingLeft: horizontalSpace.md,
    paddingRight: horizontalSpace.md,
    paddingTop: verticalSpace.xl,
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
    paddingBottom: verticalSpace["5xl"],
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace["5xl"],
  },
  card: {
    boxShadow: shadow.sm,
    width: "100%",
  },
  form: {
    gap: gap["3xl"],
  },
  imageAsset: {
    gap: gap["xl"],
  },
  imageAssetHeader: {
    gap: gap["md"],
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  imageGuidelinesList: {
    gap: gap.xs,
  },
  requiredLabel: {
    gap: gap.xs,
    alignItems: "center",
  },
  imagePreviewHero: {
    borderColor: uiColor.border1,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    overflow: "hidden",
    aspectRatio: "16 / 9",
    backgroundColor: uiColor.overlayBackdrop,
    objectFit: "cover",
    width: "100%",
  },
  imagePreviewIcon: {
    borderColor: uiColor.border1,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    overflow: "hidden",
    backgroundColor: uiColor.overlayBackdrop,
    objectFit: "cover",
    height: size["8xl"],
    width: size["8xl"],
  },
  imageIconRow: {
    gap: gap["2xl"],
    alignItems: "center",
    flexWrap: "wrap",
  },
  imageDropZone: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
  },
  imageDropZoneHero: {
    padding: 0,
    aspectRatio: "16 / 9",
  },
  imageDropZoneIcon: {
    padding: 0,
    alignSelf: "flex-start",
    aspectRatio: "1 / 1",
    width: size["9xl"],
  },
  screenshotPreviewRow: {
    gap: gap.md,
    alignItems: "stretch",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "row",
    flexWrap: {
      default: "wrap",
      [breakpoints.lg]: "nowrap",
    },
    width: "100%",
  },
  /** GridList: screenshot cards in a cluster; flexGrow set inline vs. drop slot (N:1). */
  screenshotPreviewGrid: {
    gap: gap.md,
    alignItems: "stretch",
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    minHeight: 0,
    minWidth: 0,
  },
  screenshotPreviewCard: {
    borderColor: uiColor.border1,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    gap: gap.sm,
    overflow: "hidden",
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    display: "flex",
    flexBasis: {
      default: "auto",
      [breakpoints.lg]: 0,
    },
    flexDirection: "column",
    flexGrow: {
      default: 0,
      [breakpoints.lg]: 1,
    },
    flexShrink: {
      default: 0,
      [breakpoints.lg]: 1,
    },
    minWidth: 0,
    width: {
      default: "220px",
      [breakpoints.lg]: "auto",
    },
  },
  screenshotPreviewImage: {
    cornerShape: "squircle",
    overflow: "hidden",
    backgroundColor: uiColor.overlayBackdrop,
    display: "block",
    flexShrink: 0,
    objectFit: "cover",
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    height: size["10xl"],
    maxWidth: "100%",
    width: {
      default: 200,
      [breakpoints.lg]: "100%",
    },
  },
  /** Drop zone in the screenshot row: grows to fill space + matches card stack height (less jump). */
  screenshotPreviewRowDropSlot: {
    alignSelf: "stretch",
    boxSizing: "border-box",
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: `calc(${horizontalSpace.sm} + ${horizontalSpace.sm} + ${size["10xl"]} + ${gap.sm} + ${size["2xl"]} + 2px)`,
    minWidth: 0,
  },
  screenshotPreviewActions: {
    padding: horizontalSpace.sm,
    alignItems: "center",
    justifyContent: "space-between",
  },
  screenshotDropZoneContent: {
    alignItems: "center",
    boxSizing: "border-box",
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: "center",
    minHeight: 0,
    width: "100%",
  },
  screenshotDropZoneHint: {
    textAlign: "center",
  },
  /** Between-cards insert marker: width + flex gap would shift layout; negative margins cancel. */
  screenshotReorderDropIndicator: {
    borderRadius: radius.lg,
    alignSelf: "stretch",
    backgroundColor: primaryColor.solid1,
    boxSizing: "border-box",
    flexBasis: 6,
    flexGrow: 0,
    flexShrink: 0,
    outlineColor: primaryColor.solid1,
    outlineOffset: 2,
    outlineStyle: "solid",
    outlineWidth: 2,
    position: "relative",
    /** Above sibling cards (negative margins overlap them in document order). */
    zIndex: 2,
    marginLeft: `calc((${gap.md} + 6px) / -2)`,
    marginRight: `calc((${gap.md} + 6px) / -2)`,
    width: 6,
  },
  /** Native drag preview (system drag image): small square crop of the screenshot. */
  screenshotDragPreview: {
    borderColor: uiColor.border2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    boxShadow: shadow.md,
    display: "block",
    objectFit: "cover",
    height: size["5xl"],
    width: size["5xl"],
  },
  screenshotDragPreviewPlaceholder: {
    borderColor: uiColor.border2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    backgroundColor: uiColor.bgSubtle,
    boxSizing: "border-box",
    height: size["5xl"],
    width: size["5xl"],
  },
  stickyFooterActions: {
    justifyContent: "flex-end",
    width: "100%",
  },
  saveBlockedReasonsList: {
    gap: gap["xs"],
    paddingLeft: horizontalSpace["2xl"],
  },
  saveBlockedReasonsPopover: {
    maxWidth: "20rem",
  },
  linksList: {
    gap: gap["xl"],
  },
  linkRowTypeField: {
    minWidth: "12rem",
  },
  linkRowTypeFieldPrivacyTermsText: {
    boxSizing: "border-box",
    paddingLeft: `calc(${horizontalSpace.md} + 1px)`,
    paddingRight: `calc(${horizontalSpace.md} + 1px)`,
  },
  linkRowUrlField: {
    flexBasis: "20rem",
    flexGrow: 1,
    minWidth: 0,
  },
  linkRowLabelField: {
    flexBasis: "14rem",
    flexGrow: 1,
    minWidth: 0,
  },
  linkRowRemoveButton: {
    flexShrink: 0,
  },
  appTagsRow: {
    gap: gap["sm"],
    flexWrap: "wrap",
  },
  customTagRow: {
    flexWrap: "wrap",
  },
  customTagInput: {
    flexBasis: "16rem",
    flexGrow: 1,
    minWidth: 0,
  },
  imageAssetHeaderActions: {
    gap: gap.md,
    alignItems: "center",
    flexWrap: "wrap",
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
  /**
   * True when the user clicked "Remove hero" without staging a replacement, so
   * the existing hero should be cleared on save. Mutually exclusive with
   * `pendingHeroBlob` — picking a new image cancels the pending removal.
   */
  pendingHeroRemoval: boolean;
  pendingIconBlob: Blob | null;
  pendingScreenshotBlobs: Array<Blob>;
  retainedScreenshotUrls: Array<string>;
  links: Array<ListingLink>;
  /**
   * Editorial app tags for `apps/<slug>` listings. Empty for app-tool categories
   * since the lexicon only uses tags on top-level apps.
   */
  appTags: Array<string>;
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
  screenshotUrls?: Array<string>;
  links?: Array<ListingLink>;
  appTags?: Array<string>;
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
  /**
   * When true, the form renders a "Remove hero" toggle in the hero header that
   * stages a hero removal. The actual mutation is deferred to the next save —
   * `onSubmit` receives `pendingHeroRemoval: true` so the caller can call its
   * remove API as part of the same transaction.
   */
  allowRemoveHero?: boolean;
  /**
   * When false, the Save button stays enabled without a staged hero image
   * (still requires an icon for top-level listings). Default true — most flows
   * expect a hero for publication quality.
   */
  requireHero?: boolean;
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
  allowRemoveHero = false,
  requireHero = true,
}: ProductListingFormProps) {
  const { data: categoryTree } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryTreeQueryOptions,
  );
  const { data: allAppTagSummaries } = useSuspenseQuery(
    directoryListingApi.getAllDirectoryListingAppTagsQueryOptions,
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
  const listingHadLegacyProtocolCategory = categoryParts[0] === "protocol";
  const [categoryKind, setCategoryKind] = useState<"app" | "app-tool">(
    listingHadLegacyProtocolCategory
      ? "app"
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

  const appCategoryOptionsByApp = collectAppCategoryOptionsByApp(
    (categoryTree ?? []) as Array<CategoryTreeNode>,
  );
  const appSlugOptions = collectAppSlugOptions(
    (categoryTree ?? []) as Array<CategoryTreeNode>,
  );
  const appSlugKey = appName.trim().toLowerCase();
  const selectedAppSlugOption =
    appSlugOptions.find((option) => option.id === appSlugKey)?.id ?? null;
  const appCategoryOptions = useMemo(
    () => appCategoryOptionsByApp[appSlugKey] ?? [],
    [appCategoryOptionsByApp, appSlugKey],
  );
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

  const categorySlug =
    categoryKind === "app-tool" && appCategorySlug.trim().length > 0
      ? `apps/${appName.trim()}/${appCategorySlug.trim()}`
      : `apps/${appName.trim()}`;
  const hasValidCategoryInputs =
    categoryKind === "app-tool"
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
  const [pendingHeroRemoval, setPendingHeroRemoval] = useState(false);
  const pendingIconBlobRef = useRef<Blob | null>(null);
  const [pendingIconPreviewUrl, setPendingIconPreviewUrl] = useState<
    string | null
  >(null);
  const pendingScreenshotBlobsRef = useRef<Array<Blob>>([]);
  const screenshotIdCounterRef = useRef(0);
  const pendingScreenshotObjectUrlsRef = useRef<Set<string>>(new Set());
  const [screenshotItems, setScreenshotItems] = useState<Array<ScreenshotItem>>(
    () =>
      (initialValues.screenshotUrls ?? [])
        .slice(0, MAX_SCREENSHOT_COUNT)
        .map((url, index) => ({
          id: `initial-${String(index)}-${url}`,
          previewUrl: url,
          blob: null,
        })),
  );
  const [linkRows, setLinkRows] = useState<Array<LinkRow>>(() =>
    buildInitialLinkRows(initialValues.links),
  );

  const initialNormalizedAppTags = normalizeAppTags(
    initialValues.appTags ?? [],
  );
  const [selectedAppTags, setSelectedAppTags] = useState<Set<string>>(
    () => new Set(initialNormalizedAppTags),
  );
  const [customTagInput, setCustomTagInput] = useState("");

  /**
   * Union of tags seen on other listings (from the DB), tags already on this
   * listing, and any custom tags the user has just selected so they are
   * immediately visible as toggle buttons after being added.
   */
  const availableAppTags = (() => {
    const seen = new Set<string>();
    const ordered: Array<string> = [];
    for (const summary of allAppTagSummaries) {
      if (seen.has(summary.tag)) continue;
      seen.add(summary.tag);
      ordered.push(summary.tag);
    }
    for (const tag of initialNormalizedAppTags) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      ordered.push(tag);
    }
    for (const tag of selectedAppTags) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      ordered.push(tag);
    }
    return ordered;
  })();

  function toggleAppTag(tag: string) {
    setSelectedAppTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) {
        next.delete(tag);
      } else if (next.size < MAX_APP_TAGS_PER_LISTING) {
        next.add(tag);
      }
      return next;
    });
  }

  function addCustomAppTag() {
    const normalized = normalizeAppTag(customTagInput);
    if (!normalized) return;
    setSelectedAppTags((current) => {
      if (current.has(normalized)) return current;
      if (current.size >= MAX_APP_TAGS_PER_LISTING) return current;
      const next = new Set(current);
      next.add(normalized);
      return next;
    });
    setCustomTagInput("");
  }

  const isAppTagLimitReached = selectedAppTags.size >= MAX_APP_TAGS_PER_LISTING;
  const hasValidAppTags = categoryKind !== "app" || selectedAppTags.size > 0;

  function collectAppTagsForSubmit(): Array<string> {
    if (categoryKind !== "app") return [];
    return normalizeAppTags([...selectedAppTags]);
  }

  function updateLinkRow(id: string, patch: Partial<LinkRow>) {
    setLinkRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeLinkRow(id: string) {
    setLinkRows((rows) => rows.filter((row) => row.id !== id));
  }

  function addLinkRow() {
    setLinkRows((rows) => {
      if (rows.length >= LISTING_LINK_MAX_COUNT) return rows;
      const used = new Set(rows.map((row) => row.type));
      /** Never suggest seeded policy slots; `other` is the catch-all fallback. */
      const nextType =
        LINK_TYPE_OPTIONS.find(
          (opt) =>
            opt.id !== "privacy" && opt.id !== "terms" && !used.has(opt.id),
        )?.id ?? "other";
      return [
        ...rows,
        { id: createLinkRowId(), type: nextType, url: "", label: "" },
      ];
    });
  }

  function collectLinksForSubmit(): Array<ListingLink> {
    const out: Array<ListingLink> = [];
    for (const row of linkRows) {
      const url = row.url.trim();
      if (!url) continue;
      const type = row.type.trim() || "other";
      const label = row.label.trim();
      const link: ListingLink = { type, url };
      if (label) link.label = label;
      out.push(link);
    }
    return out;
  }
  const hasHeroImage = Boolean(
    pendingHeroPreviewUrl ||
    (initialValues.heroImageUrl && !pendingHeroRemoval),
  );
  const hasIconImage = Boolean(pendingIconPreviewUrl || initialValues.iconUrl);
  /**
   * A listing that was already persisted without a hero is in a valid
   * hero-less state — the user previously opted out (or never had one), so we
   * shouldn't force them to re-confirm by clicking "Remove hero" again. There
   * also wouldn't be a button to click, since the toggle only renders when
   * there's an existing hero to remove.
   */
  const persistedWithoutHero = allowRemoveHero && !initialValues.heroImageUrl;
  /**
   * `pendingHeroRemoval` is an explicit "save without a hero" signal so the
   * Save button stays enabled even though `hasHeroImage` is false.
   */
  const heroSatisfied =
    !requireHero || hasHeroImage || pendingHeroRemoval || persistedWithoutHero;
  const hasRequiredImages = heroSatisfied && hasIconImage;

  const saveDisabledReasons = useMemo(() => {
    const reasons: Array<string> = [];
    if (!hasValidCategoryInputs) {
      reasons.push(
        categoryKind === "app-tool"
          ? "Choose an app and a category."
          : "Choose which app this listing belongs to.",
      );
    }
    if (!hasIconImage) {
      reasons.push("Add an icon image.");
    }
    if (
      requireHero &&
      !hasHeroImage &&
      !pendingHeroRemoval &&
      !persistedWithoutHero
    ) {
      reasons.push(
        allowRemoveHero && initialValues.heroImageUrl
          ? "Add a hero image, or remove the current one to save without a hero."
          : "Add a hero image.",
      );
    }
    if (!hasValidAppTags) {
      reasons.push("Pick at least one app tag.");
    }
    return reasons;
  }, [
    hasValidCategoryInputs,
    categoryKind,
    hasIconImage,
    requireHero,
    hasHeroImage,
    pendingHeroRemoval,
    persistedWithoutHero,
    allowRemoveHero,
    initialValues.heroImageUrl,
    hasValidAppTags,
  ]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => ({
        "text/plain": String(key),
      })),
    onReorder: (event) => {
      setScreenshotItems((currentItems) =>
        reorderScreenshotItems(currentItems, event.keys, event.target),
      );
    },
    renderDragPreview: (items) => {
      const id = String(items[0]?.["text/plain"] ?? "");
      const shot = screenshotItems.find((s) => s.id === id);
      const thumb = shot?.previewUrl ? (
        <img
          src={shot.previewUrl}
          alt=""
          {...stylex.props(styles.screenshotDragPreview)}
        />
      ) : (
        <div {...stylex.props(styles.screenshotDragPreviewPlaceholder)} />
      );
      /** ~half of `size["5xl"]` (3.5rem) at default root — keeps pointer near center of drag image. */
      return { element: thumb, x: 28, y: 28 };
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        {...stylex.props(styles.screenshotReorderDropIndicator)}
      />
    ),
  });

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

  useEffect(() => {
    pendingScreenshotBlobsRef.current = screenshotItems
      .map((item) => item.blob)
      .filter((blob): blob is Blob => blob != null);
  }, [screenshotItems]);

  useEffect(() => {
    const urlsRef = pendingScreenshotObjectUrlsRef;
    return () => {
      const pending = urlsRef.current;
      for (const url of pending) {
        URL.revokeObjectURL(url);
      }
      pending.clear();
    };
  }, []);

  function onPickFile(kind: "hero" | "icon", file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    setCropSession((n) => n + 1);
    setCropKind(kind);
    setCropSourceBlob(file);
    setCropperOpen(true);
  }

  function onPickScreenshots(files: Array<File>) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      return;
    }

    setScreenshotItems((baseItems) => {
      const availableSlots = MAX_SCREENSHOT_COUNT - baseItems.length;
      if (availableSlots <= 0) {
        return baseItems;
      }
      const incomingItems = imageFiles.slice(0, availableSlots).map((file) => {
        screenshotIdCounterRef.current += 1;
        const previewUrl = URL.createObjectURL(file);
        pendingScreenshotObjectUrlsRef.current.add(previewUrl);
        return {
          id: `pending-${String(screenshotIdCounterRef.current)}`,
          previewUrl,
          blob: file,
        } satisfies ScreenshotItem;
      });
      return [...baseItems, ...incomingItems];
    });
  }

  function onRemoveScreenshot(id: string) {
    setScreenshotItems((items) => {
      const itemToRemove = items.find((item) => item.id === id);
      if (!itemToRemove) {
        return items;
      }
      if (
        itemToRemove.blob != null &&
        pendingScreenshotObjectUrlsRef.current.has(itemToRemove.previewUrl)
      ) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
        pendingScreenshotObjectUrlsRef.current.delete(itemToRemove.previewUrl);
      }
      return items.filter((item) => item.id !== id);
    });
  }

  return (
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
            pendingHeroRemoval:
              pendingHeroRemoval && !pendingHeroBlobRef.current,
            pendingIconBlob: pendingIconBlobRef.current,
            pendingScreenshotBlobs: pendingScreenshotBlobsRef.current,
            retainedScreenshotUrls: screenshotItems
              .filter((item) => item.blob == null)
              .map((item) => item.previewUrl),
            links: collectLinksForSubmit(),
            appTags: collectAppTagsForSubmit(),
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
                  Details
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
                    description="Describe what your product does, then call out your top features—paragraphs or bullets both work."
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

          <Card style={styles.card} size="lg">
            <CardBody>
              <Flex direction="column" gap="6xl">
                <Text weight="semibold" size="lg">
                  Images
                </Text>
                <Flex direction="column" style={styles.imageAsset}>
                  <Flex style={styles.imageAssetHeader}>
                    <Flex style={styles.requiredLabel}>
                      <Text size="sm" variant="secondary">
                        Hero (16:9)
                      </Text>
                      {requireHero ? (
                        <Text size="sm" variant="critical">
                          *
                        </Text>
                      ) : null}
                    </Flex>
                    {allowRemoveHero && initialValues.heroImageUrl ? (
                      <Flex style={styles.imageAssetHeaderActions}>
                        <Button
                          size="sm"
                          variant={
                            pendingHeroRemoval
                              ? "secondary"
                              : "critical-outline"
                          }
                          isDisabled={isSubmitting}
                          onPress={() => {
                            setPendingHeroRemoval((prev) => {
                              const next = !prev;
                              if (next && pendingHeroPreviewUrl) {
                                URL.revokeObjectURL(pendingHeroPreviewUrl);
                                setPendingHeroPreviewUrl(null);
                                pendingHeroBlobRef.current = null;
                              }
                              return next;
                            });
                          }}
                        >
                          {pendingHeroRemoval ? "Undo remove" : "Remove hero"}
                        </Button>
                      </Flex>
                    ) : null}
                  </Flex>
                  <UnorderedList style={styles.imageGuidelinesList}>
                    <ListItem>
                      <Text size="sm" variant="secondary">
                        Use a wide 16:9 rectangle, at least 1600 × 900 px so it
                        stays sharp on large displays. PNG, JPEG, or WebP, up to
                        12 MB.
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text size="sm" variant="secondary">
                        Include the name of the product in the image and
                        potentially the tagline.
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text size="sm" variant="secondary">
                        Keep the subject centered — the image bleeds into a
                        blurred backdrop glow behind it, so edges and corners
                        are not the place for important detail.
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text size="sm" variant="secondary">
                        Show the product itself — illustrative in-product UI
                        (panels, editors, toolbars) reads well. Landing-page
                        hero strips with &ldquo;Get started&rdquo; / &ldquo;Sign
                        up&rdquo; / &ldquo;Try it free&rdquo; do not; lean on
                        your brand palette and feel instead.
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text size="sm" variant="secondary">
                        Skip browser chrome, device mockups, cursors, cookie
                        banners, watermarks, and tiny UI text. The hero is also
                        used as the social share preview, so detail gets lost
                        when scaled down.
                      </Text>
                    </ListItem>
                  </UnorderedList>
                  <FileDropZone
                    acceptedFileTypes={["image/*"]}
                    isDisabled={isSubmitting}
                    onAddFiles={(files) => {
                      onPickFile("hero", files[0]);
                    }}
                    style={[styles.imageDropZone, styles.imageDropZoneHero]}
                  >
                    {hasHeroImage ? (
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
                            pendingIconPreviewUrl ?? initialValues.iconUrl ?? ""
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
                <Flex direction="column" style={styles.imageAsset}>
                  <Flex style={styles.imageAssetHeader}>
                    <Text size="sm" variant="secondary">
                      Screenshots (1-4)
                    </Text>
                  </Flex>
                  <div {...stylex.props(styles.screenshotPreviewRow)}>
                    {screenshotItems.length > 0 ? (
                      <GridList
                        aria-label="Selected screenshots"
                        items={screenshotItems}
                        dragAndDropHooks={dragAndDropHooks}
                        layout="grid"
                        selectionMode="none"
                        {...stylex.props(styles.screenshotPreviewGrid)}
                        style={{
                          flexBasis: 0,
                          flexGrow:
                            screenshotItems.length < MAX_SCREENSHOT_COUNT
                              ? Math.max(screenshotItems.length, 1)
                              : 1,
                          flexShrink: 1,
                          minWidth: 0,
                        }}
                      >
                        {(item) => (
                          <GridListItem
                            id={item.id}
                            textValue="Screenshot"
                            {...stylex.props(styles.screenshotPreviewCard)}
                          >
                            <Flex style={styles.screenshotPreviewActions}>
                              <AriaButton
                                slot="drag"
                                isDisabled={isSubmitting}
                                {...stylex.props(
                                  styles.screenshotPreviewActionButton,
                                )}
                              >
                                <Flex align="center" gap="xs">
                                  <GripVertical size={20} />
                                </Flex>
                              </AriaButton>
                              <IconButton
                                label="Delete screenshot"
                                variant="critical"
                                isDisabled={isSubmitting}
                                onPress={() => {
                                  onRemoveScreenshot(item.id);
                                }}
                              >
                                <Trash2 size={20} />
                              </IconButton>
                            </Flex>
                            <img
                              src={item.previewUrl}
                              alt=""
                              {...stylex.props(styles.screenshotPreviewImage)}
                            />
                          </GridListItem>
                        )}
                      </GridList>
                    ) : null}
                    {screenshotItems.length < MAX_SCREENSHOT_COUNT ? (
                      <FileDropZone
                        acceptedFileTypes={["image/*"]}
                        isDisabled={isSubmitting}
                        onAddFiles={onPickScreenshots}
                        style={[
                          styles.imageDropZone,
                          styles.screenshotPreviewRowDropSlot,
                        ]}
                      >
                        <Flex
                          direction="column"
                          gap="sm"
                          style={styles.screenshotDropZoneContent}
                        >
                          <Text
                            size="sm"
                            variant="secondary"
                            style={styles.screenshotDropZoneHint}
                          >
                            Add screenshots ({screenshotItems.length}/
                            {MAX_SCREENSHOT_COUNT})
                          </Text>
                          <FileDropDefaultTrigger aria-label="Select screenshots"></FileDropDefaultTrigger>
                        </Flex>
                      </FileDropZone>
                    ) : null}
                  </div>
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
                  setPendingHeroRemoval(false);
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
              <Flex direction="column" gap="5xl">
                <Flex align="start" justify="between" gap="2xl">
                  <Flex direction="column" gap="2xl">
                    <Text weight="semibold" size="lg">
                      Links
                    </Text>
                    <Text size="sm" variant="secondary">
                      Optional — trust/compliance, support, docs, source code,
                      and other project links. Up to {LISTING_LINK_MAX_COUNT}.
                    </Text>
                  </Flex>
                  <IconButton
                    size="lg"
                    variant="secondary"
                    isDisabled={
                      isSubmitting || linkRows.length >= LISTING_LINK_MAX_COUNT
                    }
                    onPress={addLinkRow}
                    label="Add link"
                  >
                    <Plus size={14} />
                  </IconButton>
                </Flex>
                {linkRows.length > 0 ? (
                  <Flex direction="column" style={styles.linksList}>
                    {linkRows.map((row) => {
                      const isOther = row.type === "other";
                      const isAlwaysPresent =
                        row.type === "privacy" || row.type === "terms";

                      return (
                        <Flex key={row.id} align="center" wrap gap="4xl">
                          {row.type === "privacy" || row.type === "terms" ? (
                            <Text
                              size="base"
                              style={[
                                styles.linkRowTypeField,
                                styles.linkRowTypeFieldPrivacyTermsText,
                              ]}
                            >
                              {row.type === "privacy"
                                ? "Privacy policy"
                                : "Terms of service"}
                            </Text>
                          ) : (
                            <Select
                              aria-label="Link type"
                              variant="tertiary"
                              items={LINK_TYPE_OPTIONS}
                              value={row.type}
                              onChange={(value) => {
                                if (typeof value !== "string") return;
                                updateLinkRow(row.id, {
                                  type: value,
                                  ...(value === "other" ? {} : { label: "" }),
                                });
                              }}
                              style={styles.linkRowTypeField}
                              isDisabled={isAlwaysPresent}
                            >
                              {(item) => (
                                <SelectItem id={item.id}>
                                  {item.label}
                                </SelectItem>
                              )}
                            </Select>
                          )}
                          {isOther ? (
                            <TextField
                              aria-label="Link label"
                              value={row.label}
                              onChange={(value) => {
                                updateLinkRow(row.id, { label: value });
                              }}
                              placeholder="Link label"
                              style={styles.linkRowLabelField}
                              isRequired
                            />
                          ) : null}
                          <TextField
                            aria-label="Link URL"
                            value={row.url}
                            onChange={(value) => {
                              updateLinkRow(row.id, { url: value });
                            }}
                            placeholder="https://example.com/privacy"
                            style={styles.linkRowUrlField}
                            suffix={
                              row.type !== "privacy" &&
                              row.type !== "terms" && (
                                <IconButton
                                  size="md"
                                  variant="tertiary"
                                  label="Remove link"
                                  isDisabled={isSubmitting || isAlwaysPresent}
                                  onPress={() => {
                                    removeLinkRow(row.id);
                                  }}
                                  style={styles.linkRowRemoveButton}
                                >
                                  <Trash2 />
                                </IconButton>
                              )
                            }
                          />
                        </Flex>
                      );
                    })}
                  </Flex>
                ) : null}
              </Flex>
            </CardBody>
          </Card>

          <Card style={styles.card} size="lg">
            <CardBody>
              <Flex direction="column" gap="4xl">
                <Text weight="semibold" size="lg">
                  Categorization
                </Text>
                <Flex direction="column" gap="2xl">
                  <Text size="sm" variant="secondary">
                    Select the type of product you are listing.
                  </Text>
                  <UnorderedList style={styles.list}>
                    <ListItem>
                      <Text size="sm" variant="secondary">
                        <Text weight="semibold" variant="primary">
                          Standalone App
                        </Text>
                        : An app that typically defines its own lexicon and is
                        viewed as a standalone product.
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text size="sm" variant="secondary">
                        <Text weight="semibold" variant="primary">
                          Built on App
                        </Text>
                        : A tool built on top of an app that typically extends
                        the app's functionality or provides additional features.
                        An example is a Bluesky client or analytics tool.
                      </Text>
                    </ListItem>
                  </UnorderedList>
                </Flex>
                <Separator />
                {listingHadLegacyProtocolCategory ? (
                  <Alert variant="warning" title="Update category">
                    This listing used a legacy protocol category. Choose an app
                    or app tool category before saving.
                  </Alert>
                ) : null}
                <Flex direction="column" gap="6xl">
                  <Flex wrap align="center" gap="xl">
                    <Select
                      label="Type"
                      items={[
                        { id: "app", label: "Standalone App" },
                        { id: "app-tool", label: "Built on App" },
                      ]}
                      placeholder="Select type"
                      value={categoryKind}
                      onChange={(value) => {
                        if (value === "app" || value === "app-tool") {
                          setCategoryKind(value);
                        }
                      }}
                      isRequired
                      style={styles.grow}
                    >
                      {(item) => <SelectItem>{item.label}</SelectItem>}
                    </Select>
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
                          isSearchable
                          shouldFlip={false}
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
                  </Flex>
                  {categoryKind === "app-tool" ? (
                    isCustomAppCategory ? (
                      <Text size="sm" variant="critical">
                        New category detected. Please try to stick to defined
                        categories when possible.
                      </Text>
                    ) : null
                  ) : categoryKind === "app" ? (
                    <Flex direction="column" gap="5xl">
                      <Flex direction="column" gap="4xl">
                        <Flex direction="column" gap="4xl">
                          <Flex style={styles.requiredLabel}>
                            <Text weight="semibold" size="sm">
                              Tags
                            </Text>
                            <Text size="sm" variant="critical">
                              *
                            </Text>
                          </Flex>
                          <Text size="sm" variant="secondary">
                            What does your app do? Pick up to{" "}
                            {MAX_APP_TAGS_PER_LISTING} tags, or add your own.
                          </Text>
                        </Flex>
                        {availableAppTags.length > 0 ? (
                          <Flex style={styles.appTagsRow}>
                            {availableAppTags.map((tag) => {
                              const isSelected = selectedAppTags.has(tag);
                              return (
                                <ToggleButton
                                  key={tag}
                                  size="sm"
                                  variant={isSelected ? "primary" : "secondary"}
                                  isSelected={isSelected}
                                  isDisabled={
                                    isSubmitting ||
                                    (!isSelected && isAppTagLimitReached)
                                  }
                                  onChange={() => {
                                    toggleAppTag(tag);
                                  }}
                                >
                                  {formatAppTagLabel(tag)}
                                </ToggleButton>
                              );
                            })}
                          </Flex>
                        ) : null}
                        <Flex align="end" gap="md" style={styles.customTagRow}>
                          <TextField
                            aria-label="Add custom tag"
                            value={customTagInput}
                            onChange={setCustomTagInput}
                            placeholder="e.g. labeler, feed generator"
                            style={styles.customTagInput}
                            isDisabled={isSubmitting || isAppTagLimitReached}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addCustomAppTag();
                              }
                            }}
                          />
                          <IconButton
                            size="lg"
                            variant="secondary"
                            label="Add custom tag"
                            isDisabled={
                              isSubmitting ||
                              isAppTagLimitReached ||
                              normalizeAppTag(customTagInput) === null
                            }
                            onPress={addCustomAppTag}
                          >
                            <Plus size={14} />
                          </IconButton>
                        </Flex>
                        {hasValidAppTags ? null : (
                          <Text size="sm" variant="critical">
                            Pick at least one tag. You can add your own tags,
                            but prefer using the predefined tags when possible.
                          </Text>
                        )}
                        {isAppTagLimitReached ? (
                          <Text size="sm" variant="secondary">
                            You've selected the maximum of{" "}
                            {MAX_APP_TAGS_PER_LISTING} tags. Remove one to pick
                            a different tag.
                          </Text>
                        ) : null}
                      </Flex>
                    </Flex>
                  ) : null}
                </Flex>
              </Flex>
            </CardBody>
          </Card>
        </Flex>
        <Page.StickyFooter>
          <Flex align="center" justify="between" gap="2xl">
            {saveDisabledReasons.length > 0 && !isSubmitting ? (
              <Popover
                placement="top"
                trigger={
                  <IconButton
                    size="lg"
                    variant="secondary"
                    label={`Why is ${submitLabel} disabled?`}
                  >
                    <Info size={16} />
                  </IconButton>
                }
              >
                <Flex
                  direction="column"
                  gap="md"
                  style={styles.saveBlockedReasonsPopover}
                >
                  <Text size="sm" weight="semibold">
                    To {submitLabel.toLowerCase()}, complete:
                  </Text>
                  <UnorderedList style={styles.saveBlockedReasonsList}>
                    {saveDisabledReasons.map((reason) => (
                      <ListItem key={reason}>
                        <Text size="sm" variant="secondary">
                          {reason}
                        </Text>
                      </ListItem>
                    ))}
                  </UnorderedList>
                </Flex>
              </Popover>
            ) : null}
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
                isDisabled={
                  !hasValidCategoryInputs ||
                  !hasRequiredImages ||
                  !hasValidAppTags
                }
                type="submit"
              >
                {submitLabel}
              </Button>
            </Flex>
          </Flex>
        </Page.StickyFooter>
      </Form>
    </Page.Root>
  );
}
