import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Button as AriaButton,
  DropIndicator,
  GridList,
  GridListItem,
  type DropTarget,
  useDragAndDrop,
} from "react-aria-components";

import { ImageCropperDialog } from "#/components/image-cropper-dialog";
import { UserHandleAutocomplete } from "#/components/user-handle-autocomplete";
import {
  LISTING_LINK_MAX_COUNT,
  LISTING_LINK_TYPES,
  type ListingLink,
  type ListingLinkType,
} from "#/lib/atproto/listing-record";
import { formatAppTagLabel } from "#/lib/app-tag-metadata";
import { normalizeAppTag, normalizeAppTags } from "#/lib/app-tags";
import { Button } from "../design-system/button";
import { IconButton } from "../design-system/icon-button";
import { Card, CardBody } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import {
  FileDropDefaultTrigger,
  FileDropZone,
} from "../design-system/file-drop-zone";
import { Flex } from "../design-system/flex";
import { Form } from "../design-system/form";
import { Page } from "../design-system/page";
import { Select, SelectItem } from "../design-system/select";
import { TextArea } from "../design-system/text-area";
import { TextField } from "../design-system/text-field";
import { ToggleButton } from "../design-system/toggle-button";
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
import { Heading1, ListItem, UnorderedList } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { Separator } from "../design-system/separator";

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

type GenerationStatus = { tone: "neutral" | "critical"; text: string };

type ImageReviewDraft = {
  kind: "hero" | "icon";
  mimeType: string;
  imageBase64: string;
  previewSource?: "site_asset" | "model";
};

function base64ToBlob(imageBase64: string, mimeType: string): Blob {
  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

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
const DEFAULT_SEEDED_LINK_TYPES: ListingLinkType[] = ["privacy", "terms"];

function buildInitialLinkRows(
  initialLinks: ListingLink[] | undefined,
): LinkRow[] {
  const existing = (initialLinks ?? [])
    .slice(0, LISTING_LINK_MAX_COUNT)
    .map(toLinkRow);
  if (existing.length > 0) return existing;
  return DEFAULT_SEEDED_LINK_TYPES.map((type) => ({
    id: createLinkRowId(),
    type,
    url: "",
    label: "",
  }));
}

function reorderScreenshotItems(
  items: ScreenshotItem[],
  movedKeys: Set<React.Key>,
  target: DropTarget,
): ScreenshotItem[] {
  if (target.type !== "item") {
    return items;
  }
  const movingIds = new Set([...movedKeys].map((key) => String(key)));
  const movingItems = items.filter((item) => movingIds.has(item.id));
  if (movingItems.length === 0) {
    return items;
  }
  const remainingItems = items.filter((item) => !movingIds.has(item.id));
  const targetIndex = remainingItems.findIndex(
    (item) => item.id === String(target.key),
  );
  if (targetIndex < 0) {
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
  screenshotPreviewActionButton: {
    flexShrink: 0,
    height: size["4xl"],
    width: size["4xl"],
    paddingTop: verticalSpace.xs,
    paddingBottom: verticalSpace.xs,
    paddingLeft: horizontalSpace.sm,
    paddingRight: horizontalSpace.sm,
    backgroundColor: "transparent",
    borderWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // Let pointer events reach the draggable row (GridListItem); grip is for keyboard a11y.
    pointerEvents: "none",
  },
  list: {
    gap: 0,
  },
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
  imageAsset: {
    gap: gap["xl"],
  },
  imageAssetHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: gap["md"],
  },
  imageGuidelinesList: {
    gap: gap.xs,
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
  screenshotPreviewRow: {
    alignItems: "stretch",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "row",
    flexWrap: {
      default: "wrap",
      [breakpoints.lg]: "nowrap",
    },
    gap: gap.md,
    width: "100%",
  },
  /** GridList: screenshot cards in a cluster; flexGrow set inline vs. drop slot (N:1). */
  screenshotPreviewGrid: {
    alignItems: "stretch",
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: gap.md,
    minHeight: 0,
    minWidth: 0,
  },
  screenshotPreviewCard: {
    backgroundColor: uiColor.bg,
    borderColor: uiColor.border1,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: 1,
    boxSizing: "border-box",
    cornerShape: "squircle",
    display: "flex",
    flexDirection: "column",
    flexBasis: {
      default: "auto",
      [breakpoints.lg]: 0,
    },
    flexGrow: {
      default: 0,
      [breakpoints.lg]: 1,
    },
    flexShrink: {
      default: 0,
      [breakpoints.lg]: 1,
    },
    gap: gap.sm,
    minWidth: 0,
    overflow: "hidden",
    width: {
      default: "220px",
      [breakpoints.lg]: "auto",
    },
  },
  screenshotPreviewImage: {
    backgroundColor: uiColor.overlayBackdrop,
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    cornerShape: "squircle",
    display: "block",
    flexShrink: 0,
    height: size["10xl"],
    maxWidth: "100%",
    objectFit: "cover",
    overflow: "hidden",
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
    alignItems: "center",
    justifyContent: "space-between",
    padding: horizontalSpace.sm,
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
    alignSelf: "stretch",
    backgroundColor: primaryColor.solid1,
    borderRadius: radius.lg,
    boxSizing: "border-box",
    flexBasis: 6,
    flexGrow: 0,
    flexShrink: 0,
    marginLeft: `calc((${gap.md} + 6px) / -2)`,
    marginRight: `calc((${gap.md} + 6px) / -2)`,
    outlineColor: primaryColor.solid1,
    outlineOffset: 2,
    outlineStyle: "solid",
    outlineWidth: 2,
    position: "relative",
    /** Above sibling cards (negative margins overlap them in document order). */
    zIndex: 2,
    width: 6,
  },
  /** Native drag preview (system drag image): small square crop of the screenshot. */
  screenshotDragPreview: {
    borderColor: uiColor.border2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.md,
    cornerShape: "squircle",
    display: "block",
    height: size["5xl"],
    objectFit: "cover",
    width: size["5xl"],
  },
  screenshotDragPreviewPlaceholder: {
    backgroundColor: uiColor.bgSubtle,
    borderColor: uiColor.border2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    boxSizing: "border-box",
    cornerShape: "squircle",
    height: size["5xl"],
    width: size["5xl"],
  },
  stickyFooterActions: {
    justifyContent: "flex-end",
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
    flexGrow: 1,
    flexBasis: "20rem",
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
  linkRowRemoveButtonPlaceholder: {
    width: size["4xl"],
    height: size["4xl"],
    flexShrink: 0,
  },
  linkAddRow: {
    alignItems: "center",
    gap: gap["md"],
  },
  appTagsRow: {
    flexWrap: "wrap",
    gap: gap["sm"],
  },
  customTagRow: {
    flexWrap: "wrap",
  },
  customTagInput: {
    flexGrow: 1,
    flexBasis: "16rem",
    minWidth: 0,
  },
  imageAssetHeaderActions: {
    alignItems: "center",
    gap: gap.md,
    flexWrap: "wrap",
  },
  generationStatusRow: {
    minHeight: "1.25rem",
  },
  imageReviewCard: {
    boxShadow: shadow.md,
    width: "100%",
  },
  imageReviewBody: {
    gap: gap["2xl"],
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
  pendingScreenshotBlobs: Blob[];
  retainedScreenshotUrls: string[];
  links: ListingLink[];
  /**
   * Editorial app tags for `apps/<slug>` listings. Empty for app-tool / protocol
   * categories since the lexicon only uses tags on top-level apps.
   */
  appTags: string[];
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
  screenshotUrls?: string[];
  links?: ListingLink[];
  appTags?: string[];
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
   * When true, exposes admin-only tools inline in the form — currently the
   * "Generate hero / icon from URL" helpers that seed hero and icon images
   * from the product's homepage using the current `name` and `externalUrl`.
   */
  isAdmin?: boolean;
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
  isAdmin = false,
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
  const [pendingHeroRemoval, setPendingHeroRemoval] = useState(false);
  const pendingIconBlobRef = useRef<Blob | null>(null);
  const [pendingIconPreviewUrl, setPendingIconPreviewUrl] = useState<
    string | null
  >(null);
  const pendingScreenshotBlobsRef = useRef<Blob[]>([]);
  const screenshotIdCounterRef = useRef(0);
  const pendingScreenshotObjectUrlsRef = useRef<Set<string>>(new Set());
  const [screenshotItems, setScreenshotItems] = useState<ScreenshotItem[]>(() =>
    (initialValues.screenshotUrls ?? [])
      .slice(0, MAX_SCREENSHOT_COUNT)
      .map((url, index) => ({
        id: `initial-${String(index)}-${url}`,
        previewUrl: url,
        blob: null,
      })),
  );
  const [linkRows, setLinkRows] = useState<LinkRow[]>(() =>
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
    const ordered: string[] = [];
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
      } else {
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
      const next = new Set(current);
      next.add(normalized);
      return next;
    });
    setCustomTagInput("");
  }

  const hasValidAppTags = categoryKind !== "app" || selectedAppTags.size > 0;

  function collectAppTagsForSubmit(): string[] {
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

  function collectLinksForSubmit(): ListingLink[] {
    const out: ListingLink[] = [];
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
   * `pendingHeroRemoval` is an explicit "save without a hero" signal so the
   * Save button stays enabled even though `hasHeroImage` is false.
   */
  const heroSatisfied = !requireHero || hasHeroImage || pendingHeroRemoval;
  const hasRequiredImages = heroSatisfied && hasIconImage;

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

  const [pendingGeneration, setPendingGeneration] = useState<
    null | "hero" | "icon"
  >(null);
  const [imageReviewDraft, setImageReviewDraft] =
    useState<null | ImageReviewDraft>(null);
  const [generationStatus, setGenerationStatus] =
    useState<GenerationStatus | null>(null);

  async function runGeneration(kind: "hero" | "icon") {
    const trimmedName = name.trim();
    const trimmedUrl = externalUrl.trim();
    if (!trimmedName || !trimmedUrl) {
      setGenerationStatus({
        tone: "critical",
        text: "Fill in Name and Primary URL before generating images.",
      });
      return;
    }

    setPendingGeneration(kind);
    setGenerationStatus(null);
    try {
      if (kind === "hero") {
        const preview = await directoryListingApi.previewListingHeroImageByUrl({
          data: { name: trimmedName, externalUrl: trimmedUrl },
        });
        setImageReviewDraft({
          kind: "hero",
          mimeType: preview.mimeType,
          imageBase64: preview.imageBase64,
        });
        setGenerationStatus({
          tone: "neutral",
          text: "Review the hero preview below, then accept or discard.",
        });
      } else {
        const preview = await directoryListingApi.previewListingIconByUrl({
          data: { name: trimmedName, externalUrl: trimmedUrl },
        });
        setImageReviewDraft({
          kind: "icon",
          mimeType: preview.mimeType,
          imageBase64: preview.imageBase64,
          previewSource: preview.previewSource,
        });
        setGenerationStatus({
          tone: "neutral",
          text:
            preview.previewSource === "site_asset"
              ? "Preview from site favicon/logo, refined with Gemini. Accept or discard."
              : "Review the generated icon below, then accept or discard.",
        });
      }
    } catch (error) {
      setGenerationStatus({
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
    const nextPreviewUrl = URL.createObjectURL(blob);
    if (imageReviewDraft.kind === "hero") {
      setPendingHeroPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextPreviewUrl;
      });
      pendingHeroBlobRef.current = blob;
      setPendingHeroRemoval(false);
      setGenerationStatus({
        tone: "neutral",
        text: "Hero image staged. Submit the form to publish.",
      });
    } else {
      setPendingIconPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextPreviewUrl;
      });
      pendingIconBlobRef.current = blob;
      setGenerationStatus({
        tone: "neutral",
        text: "Icon staged. Submit the form to publish.",
      });
    }
    setImageReviewDraft(null);
  }

  function discardImageReview() {
    setImageReviewDraft(null);
    setGenerationStatus(null);
  }

  const isGenerateDisabled =
    pendingGeneration !== null || imageReviewDraft !== null || isSubmitting;

  useEffect(() => {
    pendingScreenshotBlobsRef.current = screenshotItems
      .map((item) => item.blob)
      .filter((blob): blob is Blob => blob != null);
  }, [screenshotItems]);

  useEffect(() => {
    return () => {
      for (const url of pendingScreenshotObjectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      pendingScreenshotObjectUrlsRef.current.clear();
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

  function onPickScreenshots(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      return;
    }

    const baseItems = screenshotItems;
    const availableSlots = MAX_SCREENSHOT_COUNT - baseItems.length;
    if (availableSlots <= 0) {
      return;
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
    setScreenshotItems([...baseItems, ...incomingItems]);
  }

  function onRemoveScreenshot(id: string) {
    const itemToRemove = screenshotItems.find((item) => item.id === id);
    if (!itemToRemove) {
      return;
    }
    if (
      itemToRemove.blob != null &&
      pendingScreenshotObjectUrlsRef.current.has(itemToRemove.previewUrl)
    ) {
      URL.revokeObjectURL(itemToRemove.previewUrl);
      pendingScreenshotObjectUrlsRef.current.delete(itemToRemove.previewUrl);
    }
    setScreenshotItems(screenshotItems.filter((item) => item.id !== id));
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
                    {isAdmin ||
                    (allowRemoveHero && initialValues.heroImageUrl) ? (
                      <Flex style={styles.imageAssetHeaderActions}>
                        {allowRemoveHero && initialValues.heroImageUrl ? (
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
                        ) : null}
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            isPending={pendingGeneration === "hero"}
                            isDisabled={isGenerateDisabled}
                            onPress={() => void runGeneration("hero")}
                          >
                            Generate hero image
                          </Button>
                        ) : null}
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
                    {isAdmin ? (
                      <Flex style={styles.imageAssetHeaderActions}>
                        <Button
                          size="sm"
                          variant="secondary"
                          isPending={pendingGeneration === "icon"}
                          isDisabled={isGenerateDisabled}
                          onPress={() => void runGeneration("icon")}
                        >
                          Generate icon
                        </Button>
                      </Flex>
                    ) : null}
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
                                size="sm"
                                variant="secondary"
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
                {isAdmin && generationStatus ? (
                  <Text
                    size="sm"
                    variant={
                      generationStatus.tone === "critical"
                        ? "critical"
                        : "secondary"
                    }
                    style={styles.generationStatusRow}
                  >
                    {generationStatus.text}
                  </Text>
                ) : null}
              </Flex>
            </CardBody>
          </Card>

          {isAdmin && imageReviewDraft ? (
            <Card style={styles.imageReviewCard} size="lg">
              <CardBody>
                <Flex direction="column" style={styles.imageReviewBody}>
                  <Text size="lg" weight="semibold">
                    {imageReviewDraft.kind === "hero"
                      ? "Review new hero image"
                      : "Review new icon"}
                  </Text>
                  {imageReviewDraft.kind === "icon" &&
                  imageReviewDraft.previewSource ? (
                    <Text size="sm" variant="secondary">
                      {imageReviewDraft.previewSource === "site_asset"
                        ? "Sourced from site favicon or logo asset, then refined with Gemini."
                        : "Generated from a homepage screenshot."}
                    </Text>
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
                      isDisabled={isSubmitting}
                      onPress={discardImageReview}
                    >
                      Discard
                    </Button>
                    <Button
                      isDisabled={isSubmitting}
                      onPress={acceptImageReview}
                    >
                      Use this image
                    </Button>
                  </Flex>
                </Flex>
              </CardBody>
            </Card>
          ) : null}

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
                          App
                        </Text>
                        : A standalone app that is used by users.
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text size="sm" variant="secondary">
                        <Text weight="semibold" variant="primary">
                          App Tool
                        </Text>
                        : A tool built on top of an app.
                      </Text>
                    </ListItem>
                  </UnorderedList>
                </Flex>
                <Separator />
                <Flex direction="column" gap="6xl">
                  <Flex wrap align="center" gap="xl">
                    <Select
                      label="Type"
                      items={[
                        { id: "app", label: "App" },
                        { id: "app-tool", label: "App Tool" },
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
                            What does your app do? Pick at least one tag, or add
                            your own.
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
                                  isDisabled={isSubmitting}
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
                              normalizeAppTag(customTagInput) === null
                            }
                            onPress={addCustomAppTag}
                          >
                            <Plus size={14} />
                          </IconButton>
                        </Flex>
                        {!hasValidAppTags ? (
                          <Text size="sm" variant="critical">
                            Pick at least one tag. You can add your own tags,
                            but prefer using the predefined tags when possible.
                          </Text>
                        ) : null}
                      </Flex>
                    </Flex>
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
        </Page.StickyFooter>
      </Form>
    </Page.Root>
  );
}
