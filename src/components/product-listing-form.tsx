import type {
  ListingLink,
  ListingLinkType,
} from "#/lib/atproto/listing-record";
import type { ReactNode } from "react";
import type { DropTarget } from "react-aria-components";

import * as stylex from "@stylexjs/stylex";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ImageCropperDialog } from "#/components/image-cropper-dialog";
import {
  FieldHelp,
  FieldLabel,
  FormCard,
  FormField,
} from "#/components/shelf/forms/FormCard";
import { FormFooter } from "#/components/shelf/forms/FormFooter";
import { ListingPreview } from "#/components/shelf/forms/ListingPreview";
import { TagPill } from "#/components/shelf/forms/TagPill";
import { PageHero } from "#/components/shelf/Section";
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
import { slugifyDirectoryListingName } from "#/lib/directory-listing-slugs";
import {
  GripVertical,
  Image as ImageIcon,
  Info,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Button as AriaButton,
  DropIndicator,
  FileTrigger,
  GridList,
  GridListItem,
  useDragAndDrop,
} from "react-aria-components";

import { Alert } from "../design-system/alert";
import { Button } from "../design-system/button";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import { SizeContext } from "../design-system/context";
import {
  FileDropDefaultTrigger,
  FileDropZone,
} from "../design-system/file-drop-zone";
import { Form } from "../design-system/form";
import { IconButton } from "../design-system/icon-button";
import { Popover } from "../design-system/popover";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../design-system/segmented-control";
import { Select, SelectItem } from "../design-system/select";
import { TextArea } from "../design-system/text-area";
import { TextField } from "../design-system/text-field";
import { criticalColor, uiColor } from "../design-system/theme/color.stylex";
import {
  breakpoints,
  containerBreakpoints,
} from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
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

/** `fyi.atstore.listing.detail#tagline` maxLength. */
const TAGLINE_MAX_LENGTH = 300;

const LINK_TYPE_OPTIONS: Array<{ id: ListingLinkType; label: string }> = [
  { id: "support", label: "Support" },
  { id: "contact", label: "Contact" },
  { id: "community", label: "Community" },
  { id: "docs", label: "Documentation" },
  { id: "blog", label: "Blog" },
  { id: "changelog", label: "Changelog" },
  { id: "source", label: "Source code" },
  { id: "license", label: "License" },
  { id: "status", label: "Status page" },
  { id: "donate", label: "Donate" },
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
  root: {
    fontFamily: fontFamily.sans,
    width: "100%",
  },
  layout: {
    alignItems: "start",
    columnGap: 48,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [containerBreakpoints.lg]: "minmax(0, 1fr) 340px",
    },
  },
  layoutSingle: {
    marginInline: "auto",
    gridTemplateColumns: "minmax(0, 1fr)",
    maxWidth: 820,
  },
  form: {
    rowGap: 20,
    minWidth: 0,
  },
  preview: {
    alignSelf: "start",
    display: { default: "none", [containerBreakpoints.lg]: "block" },
    position: "sticky",
    top: 88,
  },
  counter: {
    color: uiColor.text1,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  counterOver: {
    color: criticalColor.text1,
  },
  slugPrefix: {
    color: uiColor.text1,
    whiteSpace: "nowrap",
  },
  // Icon
  iconRow: {
    alignItems: "center",
    columnGap: 16,
    display: "flex",
  },
  iconActions: {
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    rowGap: 8,
    minWidth: 0,
  },
  // Drop zones (overrides on the DS FileDropZone)
  dropZone: {
    padding: 0,
    borderColor: {
      default: uiColor.border2,
      ":is([data-drop-target])": uiColor.text2,
      ":is([data-focus-visible])": uiColor.text2,
      ":hover": uiColor.text1,
    },
    borderStyle: {
      default: "dashed",
      ":is([data-drop-target])": "solid",
    },
    borderWidth: 1.5,
    alignItems: "center",
    backgroundColor: {
      default: uiColor.bgSubtle,
      ":is([data-drop-target])": uiColor.component1,
    },
    color: uiColor.text1,
    justifyContent: "center",
    textAlign: "center",
    minHeight: 0,
  },
  dropZoneFilled: {
    borderColor: {
      default: uiColor.border1,
      ":is([data-drop-target])": uiColor.text2,
      ":is([data-focus-visible])": uiColor.text2,
      ":hover": uiColor.border3,
    },
    borderStyle: "solid",
    borderWidth: 1,
  },
  iconDropZone: {
    borderRadius: 18,
    flexShrink: 0,
    height: 72,
    width: 72,
  },
  heroDropZoneEmpty: {
    maxHeight: 260,
  },
  heroDropZone: {
    borderRadius: 16,
    aspectRatio: "16 / 9",
    width: "100%",
  },
  dropFill: {
    inset: 0,
    display: "block",
    objectFit: "cover",
    position: "absolute",
    height: "100%",
    width: "100%",
  },
  dropPrompt: {
    paddingInline: 20,
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    fontSize: 13,
    lineHeight: 1.4,
    rowGap: 6,
  },
  dropPromptTitle: {
    color: uiColor.text2,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  heroChip: {
    borderRadius: 999,
    paddingInline: 14,
    alignItems: "center",
    backgroundColor: uiColor.bg,
    boxShadow: shadow.md,
    color: uiColor.text2,
    columnGap: 6,
    display: "inline-flex",
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    pointerEvents: "none",
    position: "absolute",
    bottom: 12,
    height: 32,
    right: 12,
  },
  // Hero guidelines
  guide: {
    color: uiColor.text2,
    fontSize: 13,
  },
  guideSummary: {
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    cursor: "pointer",
    width: "fit-content",
  },
  guideList: {
    lineHeight: 1.6,
    marginBottom: 0,
    marginTop: 10,
    paddingLeft: 18,
  },
  // Screenshots
  shotRow: {
    columnGap: 10,
    containerType: "inline-size",
    display: "flex",
    flexWrap: "wrap",
    rowGap: 10,
  },
  shotGrid: {
    columnGap: 10,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 10,
    minWidth: 0,
  },
  shotTile: {
    borderRadius: 12,
    overflow: "hidden",
    aspectRatio: "9 / 16",
    boxSizing: "border-box",
    flexShrink: 0,
    position: "relative",
    width: {
      default: "calc((100cqi - 10px) / 2)",
      "@container (min-width: 30rem)": "calc((100cqi - 30px) / 4)",
    },
  },
  shot: {
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.component1,
    cursor: "grab",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":is([data-focus-visible])": "solid" },
    outlineWidth: 2,
  },
  shotImage: {
    display: "block",
    objectFit: "cover",
    objectPosition: "top",
    height: "100%",
    width: "100%",
  },
  shotGrip: {
    padding: 2,
    borderWidth: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    color: "white",
    display: "flex",
    filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))",
    justifyContent: "center",
    // Let pointer events reach the draggable tile (GridListItem); grip is for keyboard a11y.
    pointerEvents: "none",
    position: "absolute",
    left: 4,
    top: 4,
  },
  shotDelete: {
    padding: 0,
    borderRadius: 999,
    borderWidth: 0,
    placeItems: "center",
    alignItems: "center",
    backgroundColor: {
      default: "rgba(0, 0, 0, 0.6)",
      ":is([data-hovered])": "rgba(0, 0, 0, 0.8)",
    },
    color: "white",
    cursor: "pointer",
    display: "grid",
    opacity: { default: 1, ":is([data-disabled])": 0.5 },
    outlineColor: "white",
    outlineOffset: 1,
    outlineStyle: { default: "none", ":is([data-focus-visible])": "solid" },
    outlineWidth: 2,
    position: "absolute",
    // Bigger on touch screens so it's easy to hit with a finger.
    height: { default: 24, "@media (pointer: coarse)": 32 },
    right: 6,
    top: 6,
    width: { default: 24, "@media (pointer: coarse)": 32 },
  },
  shotAdd: {
    borderRadius: 12,
  },
  shotAddContent: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    fontSize: 12,
    lineHeight: 1.35,
    rowGap: 6,
  },
  /** Between-tiles insert marker: width + flex gap would shift layout; negative margins cancel. */
  shotDropIndicator: {
    borderRadius: 999,
    marginInline: -7,
    alignSelf: "stretch",
    backgroundColor: uiColor.text2,
    boxSizing: "border-box",
    flexBasis: 4,
    flexGrow: 0,
    flexShrink: 0,
    position: "relative",
    /** Above sibling tiles (negative margins overlap them in document order). */
    zIndex: 2,
    width: 4,
  },
  /** Native drag preview (system drag image): small square crop of the screenshot. */
  shotDragPreview: {
    borderColor: uiColor.border2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    boxShadow: shadow.md,
    display: "block",
    objectFit: "cover",
    height: 56,
    width: 56,
  },
  shotDragPreviewPlaceholder: {
    borderColor: uiColor.border2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bgSubtle,
    boxSizing: "border-box",
    height: 56,
    width: 56,
  },
  // Categorization
  segmented: {
    width: "100%",
  },
  segmentedItem: {
    flexBasis: 0,
  },
  fieldRow: {
    columnGap: 16,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 16,
  },
  grow: {
    flexBasis: "14rem",
    flexGrow: 1,
    minWidth: 0,
  },
  emptyStateMessage: {
    paddingBlock: 16,
    paddingInline: 12,
    color: uiColor.text1,
    fontSize: 13,
    fontWeight: fontWeight.medium,
    textAlign: "center",
  },
  tagPicker: {
    columnGap: 8,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 8,
  },
  customTagRow: {
    alignItems: "flex-end",
    columnGap: 8,
    display: "flex",
    maxWidth: 420,
  },
  customTagInput: {
    flexGrow: 1,
    minWidth: 0,
  },
  // Links
  linkList: {
    display: "flex",
    flexDirection: "column",
    rowGap: 10,
  },
  linkRow: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexWrap: { default: "wrap", [breakpoints.md]: "nowrap" },
    rowGap: 8,
  },
  linkType: {
    flexBasis: { default: "100%", [breakpoints.md]: 180 },
    flexShrink: 0,
    minWidth: 0,
  },
  linkTypeText: {
    color: uiColor.text2,
    fontSize: 14,
  },
  linkLabel: {
    flexBasis: { default: "100%", [breakpoints.md]: 0 },
    flexGrow: 1,
    minWidth: 0,
  },
  linkUrl: {
    flexBasis: 0,
    flexGrow: 2,
    minWidth: 0,
  },
  addLink: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  // Footer
  footerActions: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexShrink: 0,
    marginLeft: "auto",
  },
  blockedReasons: {
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
    maxWidth: "20rem",
  },
  blockedReasonsTitle: {
    margin: 0,
    color: uiColor.text2,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  blockedReasonsList: {
    margin: 0,
    color: uiColor.text1,
    display: "flex",
    flexDirection: "column",
    fontSize: 13,
    lineHeight: 1.45,
    rowGap: 4,
    paddingLeft: 18,
  },
});

export type ProductListingFormSubmitValues = {
  name: string;
  /**
   * Owner-chosen URL slug. Empty string means "keep auto-deriving" — the server
   * normalizes and validates before persisting.
   */
  slug: string;
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
  /** Current URL slug; omitted on create (server auto-derives). */
  slug?: string;
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
  title: ReactNode;
  description: ReactNode;
  /** Small uppercase label above the title (e.g. "Edit listing"). */
  eyebrow?: ReactNode;
  /** Back link rendered above the page title. */
  back?: ReactNode;
  /** Muted note at the left of the sticky footer. */
  footerNote?: ReactNode;
  /**
   * Show the sticky live preview column (list row + card) on wide layouts.
   * Default true.
   */
  showPreview?: boolean;
  /** Rating shown in the preview for listings that already have reviews. */
  previewStats?: { rating: number | string | null; reviewCount: number };
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
  /**
   * Show the owner-editable "Custom URL" (slug) field. Only the owner edit flow
   * persists a slug today; create/admin flows auto-derive it, so the field is
   * hidden there to avoid capturing input that would be silently ignored.
   */
  allowSlugEdit?: boolean;
};

export function ProductListingForm({
  title,
  description,
  eyebrow,
  back,
  footerNote,
  showPreview = true,
  previewStats,
  submitLabel,
  isSubmitting,
  initialValues,
  onSubmit,
  onCancel,
  errorMessage,
  successMessage,
  allowRemoveHero = false,
  requireHero = true,
  allowSlugEdit = false,
}: ProductListingFormProps) {
  const { data: categoryTree } = useSuspenseQuery(
    directoryListingApi.getDirectoryCategoryTreeQueryOptions,
  );
  const { data: allAppTagSummaries } = useSuspenseQuery(
    directoryListingApi.getAllDirectoryListingAppTagsQueryOptions,
  );

  const [name, setName] = useState(initialValues.name);
  const [slug, setSlug] = useState(initialValues.slug ?? "");
  const [tagline, setTagline] = useState(initialValues.tagline);
  const [fullDescription, setFullDescription] = useState(
    initialValues.fullDescription,
  );
  const [externalUrl, setExternalUrl] = useState(initialValues.externalUrl);
  const [productHandle, setProductHandle] = useState(
    initialValues.productHandle,
  );

  /**
   * Preview the exact slug the server will store — `slugifyDirectoryListingName`
   * is the same normalizer used server-side, so what's shown here is what the
   * URL becomes (and what the canonical redirect resolves to). A blank field
   * falls back to the name-derived slug, matching the auto-derive default.
   */
  const slugPreview = slugifyDirectoryListingName(slug.trim() || name);
  const initialSlug = initialValues.slug ?? "";
  const slugWillChange = initialSlug.length > 0 && slugPreview !== initialSlug;

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
  const typeLabelId = useId();
  const tagsLabelId = useId();
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
          {...stylex.props(styles.shotDragPreview)}
        />
      ) : (
        <div {...stylex.props(styles.shotDragPreviewPlaceholder)} />
      );
      /** Half of the 56px drag preview — keeps the pointer near its center. */
      return { element: thumb, x: 28, y: 28 };
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        {...stylex.props(styles.shotDropIndicator)}
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

  const heroPreviewUrl = hasHeroImage
    ? (pendingHeroPreviewUrl ?? initialValues.heroImageUrl ?? null)
    : null;
  const iconPreviewUrl = pendingIconPreviewUrl ?? initialValues.iconUrl ?? null;
  const isSubmitDisabled =
    !hasValidCategoryInputs || !hasRequiredImages || !hasValidAppTags;

  const form = (
    <SizeContext value="lg">
      <Form
        style={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name,
            slug,
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
        <FormCard title="Details">
          <TextField label="Name" value={name} onChange={setName} isRequired />
          <TextField
            label="Tagline"
            value={tagline}
            onChange={setTagline}
            isRequired
            suffix={
              <span
                {...stylex.props(
                  styles.counter,
                  tagline.length > TAGLINE_MAX_LENGTH && styles.counterOver,
                )}
              >
                {tagline.length} / {TAGLINE_MAX_LENGTH}
              </span>
            }
          />
          <TextField
            label="Primary URL"
            value={externalUrl}
            onChange={setExternalUrl}
            placeholder="https://"
            isRequired
          />
          <FormField>
            <UserHandleAutocomplete
              label="Product handle"
              value={productHandle}
              onValueChange={setProductHandle}
              placeholder="your.handle.com"
              size="lg"
            />
            <FieldHelp>The product&rsquo;s own Bluesky account.</FieldHelp>
          </FormField>
          {allowSlugEdit ? (
            <FormField>
              <TextField
                label="Custom URL"
                value={slug}
                onChange={setSlug}
                placeholder={slugifyDirectoryListingName(name)}
                prefix={
                  <span {...stylex.props(styles.slugPrefix)}>/products/</span>
                }
                description={`Your listing will live at /products/${slugPreview}`}
              />
              {slugWillChange ? (
                <FieldHelp tone="critical">
                  Changing your URL will break existing links to the old address
                  (/products/{initialSlug}).
                </FieldHelp>
              ) : null}
            </FormField>
          ) : null}
          <TextArea
            label="Description"
            description="Describe what your product does, then call out your top features—paragraphs or bullets both work."
            value={fullDescription}
            onChange={setFullDescription}
            rows={10}
            autosize={false}
          />
        </FormCard>

        <FormCard title="Images">
          <FormField>
            <FieldLabel isRequired hint="square">
              Icon
            </FieldLabel>
            <div {...stylex.props(styles.iconRow)}>
              <FileDropZone
                acceptedFileTypes={["image/*"]}
                isDisabled={isSubmitting}
                onAddFiles={(files) => {
                  onPickFile("icon", files[0]);
                }}
                style={[
                  styles.dropZone,
                  styles.iconDropZone,
                  iconPreviewUrl ? styles.dropZoneFilled : null,
                ]}
              >
                {iconPreviewUrl ? (
                  <img
                    src={iconPreviewUrl}
                    alt=""
                    {...stylex.props(styles.dropFill)}
                  />
                ) : (
                  <ImageIcon size={20} aria-hidden />
                )}
                <FileDropDefaultTrigger aria-label="Select icon image" />
              </FileDropZone>
              <div {...stylex.props(styles.iconActions)}>
                <FileTrigger
                  acceptedFileTypes={["image/*"]}
                  onSelect={(files) => {
                    onPickFile("icon", files?.[0]);
                  }}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={isSubmitting}
                  >
                    <Upload size={14} aria-hidden />
                    {iconPreviewUrl ? "Change icon" : "Upload icon"}
                  </Button>
                </FileTrigger>
                <FieldHelp>
                  Square. You&rsquo;ll crop it after choosing a file.
                </FieldHelp>
              </div>
            </div>
          </FormField>

          <FormField>
            <FieldLabel
              isRequired={requireHero}
              hint="16:9"
              action={
                allowRemoveHero && initialValues.heroImageUrl ? (
                  <Button
                    size="sm"
                    variant={
                      pendingHeroRemoval ? "secondary" : "critical-outline"
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
                ) : null
              }
            >
              Hero image
            </FieldLabel>
            <FileDropZone
              acceptedFileTypes={["image/*"]}
              isDisabled={isSubmitting}
              onAddFiles={(files) => {
                onPickFile("hero", files[0]);
              }}
              style={[
                styles.dropZone,
                styles.heroDropZone,
                heroPreviewUrl
                  ? styles.dropZoneFilled
                  : styles.heroDropZoneEmpty,
              ]}
            >
              {heroPreviewUrl ? (
                <>
                  <img
                    src={heroPreviewUrl}
                    alt=""
                    {...stylex.props(styles.dropFill)}
                  />
                  <span aria-hidden {...stylex.props(styles.heroChip)}>
                    <Upload size={14} />
                    Change hero
                  </span>
                </>
              ) : (
                <span {...stylex.props(styles.dropPrompt)}>
                  <ImageIcon size={22} aria-hidden />
                  <span {...stylex.props(styles.dropPromptTitle)}>
                    Drop a 16:9 image, or click to choose
                  </span>
                  <span>
                    At least 1600 × 900 px so it stays sharp on large displays.
                    PNG, JPEG, or WebP, up to 12 MB.
                  </span>
                </span>
              )}
              <FileDropDefaultTrigger aria-label="Select hero image" />
            </FileDropZone>
            {pendingHeroRemoval ? (
              <FieldHelp>
                The current hero image will be removed when you save.
              </FieldHelp>
            ) : null}
            <details {...stylex.props(styles.guide)}>
              <summary {...stylex.props(styles.guideSummary)}>
                Hero guidelines
              </summary>
              <ul {...stylex.props(styles.guideList)}>
                <li>
                  Include the name of the product in the image and potentially
                  the tagline.
                </li>
                <li>
                  Keep the subject centered — the image bleeds into a blurred
                  backdrop glow behind it, so edges and corners are not the
                  place for important detail.
                </li>
                <li>
                  Show the product itself — illustrative in-product UI (panels,
                  editors, toolbars) reads well. Landing-page hero strips with
                  &ldquo;Get started&rdquo; / &ldquo;Sign up&rdquo; / &ldquo;Try
                  it free&rdquo; do not; lean on your brand palette and feel
                  instead.
                </li>
                <li>
                  Skip browser chrome, device mockups, cursors, cookie banners,
                  watermarks, and tiny UI text. The hero is also used as the
                  social share preview, so detail gets lost when scaled down.
                </li>
              </ul>
            </details>
          </FormField>

          <FormField>
            <FieldLabel hint={`up to ${String(MAX_SCREENSHOT_COUNT)}`}>
              Screenshots
            </FieldLabel>
            <div {...stylex.props(styles.shotRow)}>
              {screenshotItems.length > 0 ? (
                <GridList
                  aria-label="Selected screenshots"
                  items={screenshotItems}
                  dragAndDropHooks={dragAndDropHooks}
                  layout="grid"
                  selectionMode="none"
                  {...stylex.props(styles.shotGrid)}
                >
                  {(item) => (
                    <GridListItem
                      id={item.id}
                      textValue="Screenshot"
                      {...stylex.props(styles.shotTile, styles.shot)}
                    >
                      <img
                        src={item.previewUrl}
                        alt=""
                        {...stylex.props(styles.shotImage)}
                      />
                      <AriaButton
                        slot="drag"
                        isDisabled={isSubmitting}
                        {...stylex.props(styles.shotGrip)}
                      >
                        <GripVertical size={16} aria-hidden />
                      </AriaButton>
                      <AriaButton
                        aria-label="Delete screenshot"
                        isDisabled={isSubmitting}
                        onPress={() => {
                          onRemoveScreenshot(item.id);
                        }}
                        {...stylex.props(styles.shotDelete)}
                      >
                        <X size={13} strokeWidth={2.4} aria-hidden />
                      </AriaButton>
                    </GridListItem>
                  )}
                </GridList>
              ) : null}
              {screenshotItems.length < MAX_SCREENSHOT_COUNT ? (
                <FileDropZone
                  acceptedFileTypes={["image/*"]}
                  isDisabled={isSubmitting}
                  onAddFiles={onPickScreenshots}
                  style={[styles.dropZone, styles.shotTile, styles.shotAdd]}
                >
                  <span {...stylex.props(styles.shotAddContent)}>
                    <Plus size={18} aria-hidden />
                    <span>
                      Add screenshots
                      <br />
                      {screenshotItems.length}/{MAX_SCREENSHOT_COUNT}
                    </span>
                  </span>
                  <FileDropDefaultTrigger aria-label="Select screenshots" />
                </FileDropZone>
              ) : null}
            </div>
            {screenshotItems.length > 1 ? (
              <FieldHelp>Drag to reorder.</FieldHelp>
            ) : null}
          </FormField>
        </FormCard>

        <FormCard title="Categorization">
          {listingHadLegacyProtocolCategory ? (
            <Alert variant="warning" title="Update category">
              This listing used a legacy protocol category. Choose an app or app
              tool category before saving.
            </Alert>
          ) : null}
          <FormField>
            <FieldLabel id={typeLabelId} isRequired>
              Type
            </FieldLabel>
            <SegmentedControl
              aria-labelledby={typeLabelId}
              selectedKeys={[categoryKind]}
              onSelectionChange={(keys) => {
                const [value] = [...keys];
                if (value === "app" || value === "app-tool") {
                  setCategoryKind(value);
                }
              }}
              size="lg"
              style={styles.segmented}
            >
              <SegmentedControlItem id="app" style={styles.segmentedItem}>
                Standalone app
              </SegmentedControlItem>
              <SegmentedControlItem id="app-tool" style={styles.segmentedItem}>
                Built on an app
              </SegmentedControlItem>
            </SegmentedControl>
            <FieldHelp>
              A standalone app typically defines its own lexicon and is viewed
              as a standalone product. Something built on an app extends that
              app&rsquo;s functionality or adds features — for example a Bluesky
              client or analytics tool.
            </FieldHelp>
          </FormField>

          <div {...stylex.props(styles.fieldRow)}>
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
              <>
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
                    <ComboBoxItem id={item.id}>{item.label}</ComboBoxItem>
                  )}
                </ComboBox>
              </>
            )}
          </div>
          {categoryKind === "app-tool" && isCustomAppCategory ? (
            <FieldHelp tone="critical">
              New category detected. Please try to stick to defined categories
              when possible.
            </FieldHelp>
          ) : null}

          {categoryKind === "app" ? (
            <FormField>
              <FieldLabel
                id={tagsLabelId}
                isRequired
                hint={`pick up to ${String(MAX_APP_TAGS_PER_LISTING)}`}
              >
                Tags
              </FieldLabel>
              <FieldHelp>
                What does your app do? Pick up to {MAX_APP_TAGS_PER_LISTING}{" "}
                tags, or add your own.
              </FieldHelp>
              {availableAppTags.length > 0 ? (
                <div
                  role="group"
                  aria-labelledby={tagsLabelId}
                  {...stylex.props(styles.tagPicker)}
                >
                  {availableAppTags.map((tag) => {
                    const isSelected = selectedAppTags.has(tag);
                    return (
                      <TagPill
                        key={tag}
                        isSelected={isSelected}
                        isDisabled={
                          isSubmitting || (!isSelected && isAppTagLimitReached)
                        }
                        onChange={() => {
                          toggleAppTag(tag);
                        }}
                      >
                        {formatAppTagLabel(tag)}
                      </TagPill>
                    );
                  })}
                </div>
              ) : null}
              <div {...stylex.props(styles.customTagRow)}>
                <TextField
                  aria-label="Add custom tag"
                  value={customTagInput}
                  onChange={setCustomTagInput}
                  placeholder="Custom tag, e.g. labeler, feed generator"
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
              </div>
              {hasValidAppTags ? null : (
                <FieldHelp tone="critical">
                  Pick at least one tag. You can add your own tags, but prefer
                  using the predefined tags when possible.
                </FieldHelp>
              )}
              {isAppTagLimitReached ? (
                <FieldHelp>
                  You&rsquo;ve selected the maximum of{" "}
                  {MAX_APP_TAGS_PER_LISTING} tags. Remove one to pick a
                  different tag.
                </FieldHelp>
              ) : null}
            </FormField>
          ) : null}
        </FormCard>

        <FormCard
          title="Links"
          description={`Optional — trust/compliance, support, docs, source code, and other project links. Up to ${String(LISTING_LINK_MAX_COUNT)}.`}
        >
          <div {...stylex.props(styles.linkList)}>
            {linkRows.map((row) => {
              const isOther = row.type === "other";
              const isAlwaysPresent =
                row.type === "privacy" || row.type === "terms";

              return (
                <div key={row.id} {...stylex.props(styles.linkRow)}>
                  {isAlwaysPresent ? (
                    <span
                      {...stylex.props(styles.linkType, styles.linkTypeText)}
                    >
                      {row.type === "privacy"
                        ? "Privacy policy"
                        : "Terms of service"}
                    </span>
                  ) : (
                    <Select
                      aria-label="Link type"
                      items={LINK_TYPE_OPTIONS}
                      value={row.type}
                      onChange={(value) => {
                        if (typeof value !== "string") return;
                        updateLinkRow(row.id, {
                          type: value,
                          ...(value === "other" ? {} : { label: "" }),
                        });
                      }}
                      style={styles.linkType}
                    >
                      {(item) => (
                        <SelectItem id={item.id}>{item.label}</SelectItem>
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
                      style={styles.linkLabel}
                      isRequired
                    />
                  ) : null}
                  <TextField
                    aria-label="Link URL"
                    value={row.url}
                    onChange={(value) => {
                      updateLinkRow(row.id, { url: value });
                    }}
                    placeholder={
                      row.type === "privacy"
                        ? "https://example.com/privacy"
                        : row.type === "terms"
                          ? "https://example.com/terms"
                          : "https://"
                    }
                    style={styles.linkUrl}
                  />
                  {isAlwaysPresent ? null : (
                    <IconButton
                      size="md"
                      variant="tertiary"
                      label="Remove link"
                      isDisabled={isSubmitting}
                      onPress={() => {
                        removeLinkRow(row.id);
                      }}
                    >
                      <X size={15} />
                    </IconButton>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={
              isSubmitting || linkRows.length >= LISTING_LINK_MAX_COUNT
            }
            onPress={addLinkRow}
            style={styles.addLink}
          >
            <Plus size={14} aria-hidden />
            Add link
          </Button>
        </FormCard>

        {errorMessage ? (
          <Alert variant="critical" title={errorMessage} />
        ) : null}
        {successMessage ? (
          <Alert variant="success" title={successMessage} />
        ) : null}

        <FormFooter note={footerNote}>
          <div {...stylex.props(styles.footerActions)}>
            {saveDisabledReasons.length > 0 && !isSubmitting ? (
              <Popover
                placement="top"
                trigger={
                  <IconButton
                    size="lg"
                    variant="tertiary"
                    aria-label={`Why is ${submitLabel} disabled?`}
                  >
                    <Info size={16} />
                  </IconButton>
                }
              >
                <div {...stylex.props(styles.blockedReasons)}>
                  <p {...stylex.props(styles.blockedReasonsTitle)}>
                    To {submitLabel.toLowerCase()}, complete:
                  </p>
                  <ul {...stylex.props(styles.blockedReasonsList)}>
                    {saveDisabledReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </Popover>
            ) : null}
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
              isDisabled={isSubmitDisabled}
              type="submit"
            >
              {submitLabel}
            </Button>
          </div>
        </FormFooter>
      </Form>
    </SizeContext>
  );

  return (
    <div {...stylex.props(styles.root)}>
      <PageHero
        back={back}
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <div
        {...stylex.props(styles.layout, !showPreview && styles.layoutSingle)}
      >
        {form}
        {showPreview ? (
          <aside aria-label="Preview" {...stylex.props(styles.preview)}>
            <ListingPreview
              values={{
                name,
                slug: slugPreview,
                tagline,
                iconUrl: iconPreviewUrl,
                productAccountHandle: productHandle,
                appTags: categoryKind === "app" ? [...selectedAppTags] : [],
                rating: previewStats?.rating ?? null,
                reviewCount: previewStats?.reviewCount ?? 0,
              }}
            />
          </aside>
        ) : null}
      </div>

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
    </div>
  );
}
