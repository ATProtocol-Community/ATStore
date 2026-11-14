/**
 * Read-only conversion from an AT Store listing (`fyi.atstore.listing.detail`) to the Lexicon
 * Community app records. It prepares record content and reports what stands in the way. It
 * never publishes, and it never edits a value to make it fit.
 *
 * Schemas: https://tangled.org/lexicon.community/lexicons (commit 47d55d9, 2026-10-06).
 */
import type { Blob as AtprotoBlob } from "@atcute/lexicons/interfaces";
import type { FyiAtstoreListingDetail } from "#/lib/atproto/listing-record";

import { isDatetime, isDid, isGenericUri } from "@atcute/lexicons/syntax";
import { getBlobCidString } from "#/lib/atproto/blob-cdn-url";
import { graphemeLength } from "#/lib/atproto/bluesky-facets";
import { COMMUNITY_APP_NSID } from "#/lib/atproto/nsids";

/**
 * `app.entry` is a listing any account can publish (record key: a TID). `app.profile` is the
 * app's own profile, published from the app's account at record key `self`.
 */
export type CommunityAppFormat = "app.entry" | "app.profile";

/**
 * Alt text for a listing's images. `fyi.atstore.listing.detail` holds bare blobs and the
 * community schema requires alt text on every image, so the caller supplies it.
 */
export type ListingImageAlt = {
  icon?: string;
  heroImage?: string;
  /** In the same order as the listing's `screenshots`. */
  screenshots?: ReadonlyArray<string | null | undefined>;
};

export type CommunityAppLink = {
  uri: string;
  label?: string;
  /** A `community.lexicon.app.defs#linkRole…` token. Left out when no known role fits. */
  role?: string;
};

export type CommunityAppImage = {
  /** A `community.lexicon.app.defs#purpose…` token. */
  purpose: string;
  image: AtprotoBlob;
  alt: string;
};

/** The fields this conversion writes. The schemas allow more (status, platforms, …). */
type CommunityAppFields = {
  name: string;
  description?: string;
  longDescription?: string;
  images?: Array<CommunityAppImage>;
  tags?: Array<string>;
  links: Array<CommunityAppLink>;
  createdAt: string;
  updatedAt?: string;
};

export type CommunityAppEntry = CommunityAppFields & {
  $type: typeof COMMUNITY_APP_NSID.entry;
  profileDid?: string;
};

export type CommunityAppProfile = CommunityAppFields & {
  $type: typeof COMMUNITY_APP_NSID.profile;
};

export type CommunityAppProblemCode =
  | "missing_required_field"
  | "missing_image_alt"
  | "too_many_graphemes"
  | "too_many_bytes"
  | "too_many_items"
  | "image_too_large"
  | "invalid_image"
  | "invalid_uri"
  | "invalid_did"
  | "invalid_datetime";

/** Something that stops the listing from becoming a valid community record. */
export type CommunityAppProblem = {
  code: CommunityAppProblemCode;
  /** Path in the AT Store listing, e.g. `screenshots[1]`. */
  sourcePath: string;
  /** Path in the community record, e.g. `images[2].alt`. */
  targetPath: string;
  message: string;
  /** Set on `too_many_*` and `image_too_large`, in the unit the code names. */
  actual?: number;
  allowed?: number;
};

/** Listing information the community record does not carry. It never blocks conversion. */
export type CommunityAppUnmappedField = {
  code: "no_community_equivalent" | "placeholder_tagline";
  sourcePath: string;
  message: string;
};

export type CommunityAppConversion =
  | {
      ok: true;
      record: CommunityAppEntry | CommunityAppProfile;
      unmapped: Array<CommunityAppUnmappedField>;
    }
  | {
      ok: false;
      problems: Array<CommunityAppProblem>;
      unmapped: Array<CommunityAppUnmappedField>;
    };

type TextLimits = { maxGraphemes: number; maxBytes: number };

/** In the schemas, `maxLength` counts UTF-8 bytes and `maxGraphemes` counts characters. */
const LIMITS = {
  name: { maxGraphemes: 100, maxBytes: 200 },
  description: { maxGraphemes: 300, maxBytes: 3000 },
  longDescription: { maxGraphemes: 4000, maxBytes: 40_000 },
  tag: { maxGraphemes: 32, maxBytes: 64 },
  linkLabel: { maxGraphemes: 50, maxBytes: 100 },
  imageAlt: { maxGraphemes: 300, maxBytes: 1000 },
  maxTags: 10,
  maxLinks: 12,
  maxImages: 24,
  maxImageBytes: 2_000_000,
} as const;

const DEFS = "community.lexicon.app.defs";

const WEBSITE_LINK_ROLE = `${DEFS}#linkRoleWebsite`;

/**
 * `fyi.atstore.listing.detail#link.type` to community link role. The support role is described
 * as "Support, help, or contact page", so `contact` shares it. `blog`, `community`, `donate`
 * and `license` have no role. A Map, because a link type is free text and a plain object
 * would answer for keys like `constructor`.
 */
const LINK_ROLE_BY_LISTING_LINK_TYPE = new Map([
  ["privacy", `${DEFS}#linkRolePrivacyPolicy`],
  ["terms", `${DEFS}#linkRoleTermsOfService`],
  ["support", `${DEFS}#linkRoleSupport`],
  ["contact", `${DEFS}#linkRoleSupport`],
  ["docs", `${DEFS}#linkRoleDocs`],
  ["changelog", `${DEFS}#linkRoleChangelog`],
  ["source", `${DEFS}#linkRoleSourceCode`],
  ["status", `${DEFS}#linkRoleStatus`],
]);

/** What `listing-record.ts` and Tap ingest write when a listing has no tagline. */
const TAGLINE_PLACEHOLDER = "—";

const ATSTORE_ONLY_FIELDS = [
  [
    "slug",
    "The slug has no community equivalent. It stays on the AT Store listing.",
  ],
  [
    "categorySlug",
    "The categories have no community equivalent. They stay on the AT Store listing.",
  ],
  [
    "migratedFromAtUri",
    "The link to the listing's earlier record has no community equivalent. It stays on the AT Store listing.",
  ],
  [
    "game",
    "The link to the listing's game record has no community equivalent. It stays on the AT Store listing.",
  ],
] as const;

const textEncoder = new TextEncoder();

/** The string, unchanged, when it holds something other than whitespace. */
function presentText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return value != null;
}

/**
 * The blob as a fresh JSON-form object, when it is an image whose CID and size can be read.
 * Legacy blobs carry no size, so they cannot be checked against the size limit.
 */
function toImageBlob(raw: unknown): AtprotoBlob | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const { mimeType, size } = raw as { mimeType?: unknown; size?: unknown };
  const cid = getBlobCidString(raw);
  if (
    cid === null ||
    typeof mimeType !== "string" ||
    !mimeType.startsWith("image/") ||
    !Number.isInteger(size) ||
    (size as number) < 0
  ) {
    return undefined;
  }
  return { $type: "blob", mimeType, ref: { $link: cid }, size: size as number };
}

/**
 * Prepare a `community.lexicon.app.entry` or `community.lexicon.app.profile` record from a
 * listing. Returns the record when it satisfies the community schema; otherwise every problem
 * found, so they can be fixed in one pass. The listing is not modified, and the record shares
 * no objects with it.
 *
 * The two formats differ in one field: an entry points at the app's account with `profileDid`
 * (from `productAccountDid`), while a profile is published from that account and has no such
 * field.
 */
export function convertListingToCommunityApp(
  listing: FyiAtstoreListingDetail,
  format: CommunityAppFormat,
  options: { imageAlt?: ListingImageAlt } = {},
): CommunityAppConversion {
  const problems: Array<CommunityAppProblem> = [];
  const unmapped: Array<CommunityAppUnmappedField> = [];

  function checkText(
    text: string,
    limits: TextLimits,
    subject: string,
    sourcePath: string,
    targetPath: string,
  ) {
    const graphemes = graphemeLength(text);
    if (graphemes > limits.maxGraphemes) {
      problems.push({
        code: "too_many_graphemes",
        sourcePath,
        targetPath,
        message: `${subject} has ${graphemes} characters; the limit is ${limits.maxGraphemes}.`,
        actual: graphemes,
        allowed: limits.maxGraphemes,
      });
    }
    const bytes = textEncoder.encode(text).length;
    if (bytes > limits.maxBytes) {
      problems.push({
        code: "too_many_bytes",
        sourcePath,
        targetPath,
        message: `${subject} takes ${bytes} bytes; the limit is ${limits.maxBytes}.`,
        actual: bytes,
        allowed: limits.maxBytes,
      });
    }
  }

  for (const [field, message] of ATSTORE_ONLY_FIELDS) {
    if (hasValue(listing[field])) {
      unmapped.push({
        code: "no_community_equivalent",
        sourcePath: field,
        message,
      });
    }
  }

  const name = presentText(listing.name);
  if (name === undefined) {
    problems.push({
      code: "missing_required_field",
      sourcePath: "name",
      targetPath: "name",
      message: "The listing needs a name.",
    });
  } else {
    checkText(name, LIMITS.name, "The name", "name", "name");
  }

  let description = presentText(listing.tagline);
  if (description === TAGLINE_PLACEHOLDER) {
    description = undefined;
    unmapped.push({
      code: "placeholder_tagline",
      sourcePath: "tagline",
      message: `The tagline is the "${TAGLINE_PLACEHOLDER}" placeholder AT Store writes when a listing has none, so no description is set.`,
    });
  } else if (description !== undefined) {
    checkText(
      description,
      LIMITS.description,
      "The tagline",
      "tagline",
      "description",
    );
  }

  const longDescription = presentText(listing.description);
  if (longDescription !== undefined) {
    checkText(
      longDescription,
      LIMITS.longDescription,
      "The description",
      "description",
      "longDescription",
    );
  }

  const imageAlt = options.imageAlt ?? {};
  const sourceImages: Array<{
    blob: unknown;
    alt: unknown;
    purpose: string;
    sourcePath: string;
    subject: string;
  }> = [];
  if (listing.icon != null) {
    sourceImages.push({
      blob: listing.icon,
      alt: imageAlt.icon,
      purpose: `${DEFS}#purposeIcon`,
      sourcePath: "icon",
      subject: "The icon",
    });
  }
  if (listing.heroImage != null) {
    sourceImages.push({
      blob: listing.heroImage,
      alt: imageAlt.heroImage,
      purpose: `${DEFS}#purposeHero`,
      sourcePath: "heroImage",
      subject: "The hero image",
    });
  }
  for (const [i, blob] of (listing.screenshots ?? []).entries()) {
    sourceImages.push({
      blob,
      alt: imageAlt.screenshots?.[i],
      purpose: `${DEFS}#purposeScreenshot`,
      sourcePath: `screenshots[${i}]`,
      subject: `Screenshot ${i + 1}`,
    });
  }

  if (sourceImages.length > LIMITS.maxImages) {
    problems.push({
      code: "too_many_items",
      sourcePath: "screenshots",
      targetPath: "images",
      message: `The listing has ${sourceImages.length} images; the limit is ${LIMITS.maxImages}.`,
      actual: sourceImages.length,
      allowed: LIMITS.maxImages,
    });
  }

  const images: Array<CommunityAppImage> = [];
  for (const [i, source] of sourceImages.entries()) {
    const { sourcePath, subject } = source;
    const image = toImageBlob(source.blob);
    if (image === undefined) {
      problems.push({
        code: "invalid_image",
        sourcePath,
        targetPath: `images[${i}].image`,
        message: `${subject} is not an image blob with a known size.`,
      });
    } else if (image.size > LIMITS.maxImageBytes) {
      problems.push({
        code: "image_too_large",
        sourcePath,
        targetPath: `images[${i}].image`,
        message: `${subject} is ${image.size} bytes; the limit is ${LIMITS.maxImageBytes}.`,
        actual: image.size,
        allowed: LIMITS.maxImageBytes,
      });
    }

    // Blank alt text counts as missing: the schema would take an empty string, but it would
    // describe nothing.
    const alt = presentText(source.alt);
    if (alt === undefined) {
      problems.push({
        code: "missing_image_alt",
        sourcePath,
        targetPath: `images[${i}].alt`,
        message: `${subject} needs alt text.`,
      });
    } else {
      checkText(
        alt,
        LIMITS.imageAlt,
        `${subject}'s alt text`,
        sourcePath,
        `images[${i}].alt`,
      );
    }

    if (image !== undefined && alt !== undefined) {
      images.push({ purpose: source.purpose, image, alt });
    }
  }

  const tags = [...(listing.appTags ?? [])];
  if (tags.length > LIMITS.maxTags) {
    problems.push({
      code: "too_many_items",
      sourcePath: "appTags",
      targetPath: "tags",
      message: `The listing has ${tags.length} tags; the limit is ${LIMITS.maxTags}.`,
      actual: tags.length,
      allowed: LIMITS.maxTags,
    });
  }
  for (const [i, tag] of tags.entries()) {
    checkText(tag, LIMITS.tag, `Tag ${i + 1}`, `appTags[${i}]`, `tags[${i}]`);
  }

  const productAccountDid = presentText(listing.productAccountDid);
  if (productAccountDid !== undefined) {
    if (format === "app.profile") {
      unmapped.push({
        code: "no_community_equivalent",
        sourcePath: "productAccountDid",
        message:
          "A profile is published from the app's own account, so the product account is not a field on it.",
      });
    } else if (!isDid(productAccountDid)) {
      problems.push({
        code: "invalid_did",
        sourcePath: "productAccountDid",
        targetPath: "profileDid",
        message: "The product account is not a valid DID.",
      });
    }
  }

  // The website comes first: the schema asks for the primary destination as the first link.
  const sourceLinks = listing.links ?? [];
  const linkCount = sourceLinks.length + 1;
  if (linkCount > LIMITS.maxLinks) {
    problems.push({
      code: "too_many_items",
      sourcePath: "links",
      targetPath: "links",
      message: `The website and ${sourceLinks.length} other links make ${linkCount} links; the limit is ${LIMITS.maxLinks}.`,
      actual: linkCount,
      allowed: LIMITS.maxLinks,
    });
  }

  const links: Array<CommunityAppLink> = [];
  const website = presentText(listing.externalUrl);
  if (website === undefined) {
    problems.push({
      code: "missing_required_field",
      sourcePath: "externalUrl",
      targetPath: "links[0].uri",
      message: "The listing needs a website address.",
    });
  } else if (isGenericUri(website)) {
    links.push({ uri: website, role: WEBSITE_LINK_ROLE });
  } else {
    problems.push({
      code: "invalid_uri",
      sourcePath: "externalUrl",
      targetPath: "links[0].uri",
      message: "The website address is not a valid URI.",
    });
  }

  for (const [i, sourceLink] of sourceLinks.entries()) {
    const sourcePath = `links[${i}]`;
    const targetPath = `links[${i + 1}]`;

    const uri = presentText(sourceLink.url);
    if (uri === undefined) {
      problems.push({
        code: "missing_required_field",
        sourcePath: `${sourcePath}.url`,
        targetPath: `${targetPath}.uri`,
        message: `Link ${i + 1} needs a URL.`,
      });
    } else if (!isGenericUri(uri)) {
      problems.push({
        code: "invalid_uri",
        sourcePath: `${sourcePath}.url`,
        targetPath: `${targetPath}.uri`,
        message: `Link ${i + 1} does not have a valid URI.`,
      });
    }

    const label = presentText(sourceLink.label);
    if (label !== undefined) {
      checkText(
        label,
        LIMITS.linkLabel,
        `Link ${i + 1}'s label`,
        `${sourcePath}.label`,
        `${targetPath}.label`,
      );
    }

    const type = presentText(sourceLink.type);
    const role =
      type === undefined ? undefined : LINK_ROLE_BY_LISTING_LINK_TYPE.get(type);
    // `other` already means "no known kind", which is what a link without a role says.
    if (type !== undefined && role === undefined && type !== "other") {
      unmapped.push({
        code: "no_community_equivalent",
        sourcePath: `${sourcePath}.type`,
        message: `Link type "${type}" has no community link role, so link ${i + 1} is kept without one.`,
      });
    }

    if (uri !== undefined) {
      const link: CommunityAppLink = { uri };
      if (label !== undefined) link.label = label;
      if (role !== undefined) link.role = role;
      links.push(link);
    }
  }

  const createdAt = presentText(listing.createdAt);
  if (createdAt === undefined) {
    problems.push({
      code: "missing_required_field",
      sourcePath: "createdAt",
      targetPath: "createdAt",
      message: "The listing needs a created date.",
    });
  } else if (!isDatetime(createdAt)) {
    problems.push({
      code: "invalid_datetime",
      sourcePath: "createdAt",
      targetPath: "createdAt",
      message: "The created date is not a valid datetime.",
    });
  }

  const updatedAt = presentText(listing.updatedAt);
  if (updatedAt !== undefined && !isDatetime(updatedAt)) {
    problems.push({
      code: "invalid_datetime",
      sourcePath: "updatedAt",
      targetPath: "updatedAt",
      message: "The updated date is not a valid datetime.",
    });
  }

  // The two `undefined` checks repeat problems already recorded; they narrow the types.
  if (problems.length > 0 || name === undefined || createdAt === undefined) {
    return { ok: false, problems, unmapped };
  }

  const record: CommunityAppEntry | CommunityAppProfile =
    format === "app.entry"
      ? { $type: COMMUNITY_APP_NSID.entry, name, links, createdAt }
      : { $type: COMMUNITY_APP_NSID.profile, name, links, createdAt };
  if (description !== undefined) record.description = description;
  if (longDescription !== undefined) record.longDescription = longDescription;
  if (images.length > 0) record.images = images;
  if (tags.length > 0) record.tags = tags;
  if (
    record.$type === COMMUNITY_APP_NSID.entry &&
    productAccountDid !== undefined
  ) {
    record.profileDid = productAccountDid;
  }
  if (updatedAt !== undefined) record.updatedAt = updatedAt;

  return { ok: true, record, unmapped };
}
