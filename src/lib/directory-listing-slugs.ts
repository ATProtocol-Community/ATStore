type DirectoryListingSlugSource = {
  name: string;
  slug?: string | null;
  sourceUrl?: string | null;
};

const DIRECTORY_LISTING_SLUG_OVERRIDES_BY_SOURCE_URL: Record<string, string> = {
  "https://blueskydirectory.com/utilities/byesky": "byesky",
  "https://blueskydirectory.com/utilities/byesky-6884fa611293d":
    "byesky-github",
};

const DIRECTORY_LISTING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function slugifyDirectoryListingName(name: string) {
  const slug = name
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/['’]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return slug || "product";
}

export function buildDirectoryListingSlug(
  listing: Pick<DirectoryListingSlugSource, "name" | "sourceUrl">,
) {
  const overriddenSlug = listing.sourceUrl
    ? DIRECTORY_LISTING_SLUG_OVERRIDES_BY_SOURCE_URL[listing.sourceUrl]
    : undefined;

  return overriddenSlug ?? slugifyDirectoryListingName(listing.name);
}

export function getDirectoryListingSlug(listing: DirectoryListingSlugSource) {
  return listing.slug?.trim() || buildDirectoryListingSlug(listing);
}

export function getDirectoryListingHref(listing: DirectoryListingSlugSource) {
  return `/products/${getDirectoryListingSlug(listing)}`;
}

export function getLegacyDirectoryListingId(pathSegment: string) {
  const normalizedValue = pathSegment.trim().replaceAll(/^\/+|\/+$/g, "");

  if (DIRECTORY_LISTING_ID_PATTERN.test(normalizedValue)) {
    return normalizedValue;
  }

  const separatorIndex = normalizedValue.lastIndexOf("--");
  if (separatorIndex === -1) {
    return null;
  }

  const maybeId = normalizedValue.slice(separatorIndex + 2);
  return DIRECTORY_LISTING_ID_PATTERN.test(maybeId) ? maybeId : null;
}
