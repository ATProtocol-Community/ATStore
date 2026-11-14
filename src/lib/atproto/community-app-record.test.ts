import type { Blob as AtprotoBlob } from "@atcute/lexicons/interfaces";
import type {
  CommunityAppConversion,
  ListingImageAlt,
} from "#/lib/atproto/community-app-record";
import type { FyiAtstoreListingDetail } from "#/lib/atproto/listing-record";

import { convertListingToCommunityApp } from "#/lib/atproto/community-app-record";
import { describe, expect, it } from "vitest";

const DEFS = "community.lexicon.app.defs";

const ICON_CID = "bafkreih24pzxubln3sjkfltnnemoopcpy6fs7jys7l3rgctslvpfnqsdhe";
const HERO_CID = "bafkreidy6gy2ka6hycaxavyfpgek3czs7j6ttystyteiuvgrfvwm4ywhtq";
const SHOT_A_CID =
  "bafkreig43q42ob4qyobrn3vqtfyzfl3gpzrbsoxw7go4g2x7l2zux2uxxe";
const SHOT_B_CID =
  "bafkreiflhhplqfg4pea4tadbqbnrzqn3ildjwpoq7m3kbmflu2ckckxe3y";

function blob(cid: string, size: number, mimeType = "image/png"): AtprotoBlob {
  return { $type: "blob", ref: { $link: cid }, mimeType, size };
}

/** Frozen all the way down, so a conversion that wrote to its input would throw. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** A listing that uses every field, with values the community schema takes as they are. */
const listing: FyiAtstoreListingDetail = deepFreeze({
  $type: "fyi.atstore.listing.detail",
  slug: "example-reader",
  name: "Example Reader",
  tagline: "A quiet feed reader for the Atmosphere.",
  description:
    "Example Reader gathers the feeds you follow into one list.\n\nIt keeps your place across devices.",
  externalUrl: "https://reader.example",
  icon: blob(ICON_CID, 48_000),
  heroImage: blob(HERO_CID, 900_000, "image/jpeg"),
  screenshots: [
    blob(SHOT_A_CID, 400_000),
    blob(SHOT_B_CID, 410_000, "image/webp"),
  ],
  categorySlug: ["apps/reader", "apps/social"],
  createdAt: "2026-03-02T10:00:00.000Z",
  updatedAt: "2026-09-14T08:30:00.000Z",
  appTags: ["reader", "feeds"],
  productAccountDid: "did:web:reader.example",
  migratedFromAtUri:
    "at://did:web:store.example/fyi.atstore.listing.detail/3lxyzabc2345k",
  game: "at://did:web:reader.example/games.atmosphere.define/3lxyzabc2345m",
  links: [
    { type: "privacy", url: "https://reader.example/privacy" },
    {
      type: "source",
      url: "https://code.example/reader",
      label: "Source on Tangled",
    },
    { type: "blog", url: "https://reader.example/blog" },
    { type: "other", url: "https://reader.example/press", label: "Press kit" },
  ],
});

const imageAlt: ListingImageAlt = deepFreeze({
  icon: "An open book on a blue square",
  heroImage: "Example Reader showing a list of unread posts",
  screenshots: [
    "The reading list with three unread feeds",
    "The settings screen with sync turned on",
  ],
});

const communityFields = {
  name: "Example Reader",
  description: "A quiet feed reader for the Atmosphere.",
  longDescription:
    "Example Reader gathers the feeds you follow into one list.\n\nIt keeps your place across devices.",
  images: [
    {
      purpose: `${DEFS}#purposeIcon`,
      image: blob(ICON_CID, 48_000),
      alt: "An open book on a blue square",
    },
    {
      purpose: `${DEFS}#purposeHero`,
      image: blob(HERO_CID, 900_000, "image/jpeg"),
      alt: "Example Reader showing a list of unread posts",
    },
    {
      purpose: `${DEFS}#purposeScreenshot`,
      image: blob(SHOT_A_CID, 400_000),
      alt: "The reading list with three unread feeds",
    },
    {
      purpose: `${DEFS}#purposeScreenshot`,
      image: blob(SHOT_B_CID, 410_000, "image/webp"),
      alt: "The settings screen with sync turned on",
    },
  ],
  tags: ["reader", "feeds"],
  links: [
    { uri: "https://reader.example", role: `${DEFS}#linkRoleWebsite` },
    {
      uri: "https://reader.example/privacy",
      role: `${DEFS}#linkRolePrivacyPolicy`,
    },
    {
      uri: "https://code.example/reader",
      label: "Source on Tangled",
      role: `${DEFS}#linkRoleSourceCode`,
    },
    { uri: "https://reader.example/blog" },
    { uri: "https://reader.example/press", label: "Press kit" },
  ],
  createdAt: "2026-03-02T10:00:00.000Z",
  updatedAt: "2026-09-14T08:30:00.000Z",
};

function recordOf(result: CommunityAppConversion) {
  if (!result.ok) {
    throw new Error(`expected a record: ${JSON.stringify(result.problems)}`);
  }
  return result.record;
}

function problemsOf(result: CommunityAppConversion) {
  if (result.ok) throw new Error("expected problems, got a record");
  return result.problems;
}

/** `count` characters of one byte each. */
const characters = (count: number) => "a".repeat(count);

/** One grapheme, 25 bytes, 11 UTF-16 code units. */
const FAMILY = "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}";

/** `count` bytes in far fewer characters, to reach a byte limit before a character limit. */
const bytes = (count: number) =>
  FAMILY.repeat(Math.floor(count / 25)) + "a".repeat(count % 25);

const tags = (count: number) =>
  Array.from({ length: count }, (_, i) => `tag-${i + 1}`);

const otherLinks = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    type: "other",
    url: `https://reader.example/page-${i + 1}`,
  }));

const screenshots = (count: number) =>
  Array.from({ length: count }, () => blob(SHOT_A_CID, 1000));

const screenshotAlts = (count: number) =>
  Array.from({ length: count }, (_, i) => `Reading list, page ${i + 1}`);

describe("convertListingToCommunityApp", () => {
  it("prepares an app.entry record", () => {
    const result = convertListingToCommunityApp(listing, "app.entry", {
      imageAlt,
    });

    expect(recordOf(result)).toStrictEqual({
      $type: "community.lexicon.app.entry",
      ...communityFields,
      profileDid: "did:web:reader.example",
    });
  });

  it("prepares an app.profile record, which has no profileDid", () => {
    const result = convertListingToCommunityApp(listing, "app.profile", {
      imageAlt,
    });

    expect(recordOf(result)).toStrictEqual({
      $type: "community.lexicon.app.profile",
      ...communityFields,
    });
  });

  it.each([
    ["app.entry", "community.lexicon.app.entry"],
    ["app.profile", "community.lexicon.app.profile"],
  ] as const)(
    "leaves out fields the listing does not have (%s)",
    (format, $type) => {
      const result = convertListingToCommunityApp(
        {
          $type: "fyi.atstore.listing.detail",
          slug: "example-reader",
          name: "Example Reader",
          tagline: "A quiet feed reader.",
          externalUrl: "https://reader.example",
          icon: blob(ICON_CID, 48_000),
          categorySlug: ["apps/reader"],
          createdAt: "2026-03-02T10:00:00.000Z",
          updatedAt: "2026-09-14T08:30:00.000Z",
        },
        format,
        { imageAlt: { icon: "An open book on a blue square" } },
      );

      expect(recordOf(result)).toStrictEqual({
        $type,
        name: "Example Reader",
        description: "A quiet feed reader.",
        images: [
          {
            purpose: `${DEFS}#purposeIcon`,
            image: blob(ICON_CID, 48_000),
            alt: "An open book on a blue square",
          },
        ],
        links: [
          { uri: "https://reader.example", role: `${DEFS}#linkRoleWebsite` },
        ],
        createdAt: "2026-03-02T10:00:00.000Z",
        updatedAt: "2026-09-14T08:30:00.000Z",
      });
    },
  );

  describe("links", () => {
    it.each([
      ["privacy", `${DEFS}#linkRolePrivacyPolicy`],
      ["terms", `${DEFS}#linkRoleTermsOfService`],
      ["support", `${DEFS}#linkRoleSupport`],
      ["contact", `${DEFS}#linkRoleSupport`],
      ["docs", `${DEFS}#linkRoleDocs`],
      ["changelog", `${DEFS}#linkRoleChangelog`],
      ["source", `${DEFS}#linkRoleSourceCode`],
      ["status", `${DEFS}#linkRoleStatus`],
    ])("gives a %s link the role %s", (type, role) => {
      const result = convertListingToCommunityApp(
        { ...listing, links: [{ type, url: "https://reader.example/page" }] },
        "app.entry",
        { imageAlt },
      );

      expect(recordOf(result).links).toStrictEqual([
        { uri: "https://reader.example", role: `${DEFS}#linkRoleWebsite` },
        { uri: "https://reader.example/page", role },
      ]);
    });

    it.each(["blog", "community", "donate", "license", "constructor"])(
      "keeps a %s link without a role and reports the type",
      (type) => {
        const result = convertListingToCommunityApp(
          { ...listing, links: [{ type, url: "https://reader.example/page" }] },
          "app.entry",
          { imageAlt },
        );

        expect(recordOf(result).links[1]).toStrictEqual({
          uri: "https://reader.example/page",
        });
        expect(result.unmapped).toContainEqual({
          code: "no_community_equivalent",
          sourcePath: "links[0].type",
          message: `Link type "${type}" has no community link role, so link 1 is kept without one.`,
        });
      },
    );

    it("keeps an `other` link without a role and has nothing to report", () => {
      const result = convertListingToCommunityApp(
        {
          ...listing,
          links: [{ type: "other", url: "https://reader.example/page" }],
        },
        "app.entry",
        { imageAlt },
      );

      expect(recordOf(result).links[1]).toStrictEqual({
        uri: "https://reader.example/page",
      });
      expect(result.unmapped.map((field) => field.sourcePath)).not.toContain(
        "links[0].type",
      );
    });
  });

  describe("information with no community equivalent", () => {
    it("is listed without blocking an entry", () => {
      const result = convertListingToCommunityApp(listing, "app.entry", {
        imageAlt,
      });

      expect(result.ok).toBe(true);
      expect(result.unmapped).toStrictEqual([
        {
          code: "no_community_equivalent",
          sourcePath: "slug",
          message:
            "The slug has no community equivalent. It stays on the AT Store listing.",
        },
        {
          code: "no_community_equivalent",
          sourcePath: "categorySlug",
          message:
            "The categories have no community equivalent. They stay on the AT Store listing.",
        },
        {
          code: "no_community_equivalent",
          sourcePath: "migratedFromAtUri",
          message:
            "The link to the listing's earlier record has no community equivalent. It stays on the AT Store listing.",
        },
        {
          code: "no_community_equivalent",
          sourcePath: "game",
          message:
            "The link to the listing's game record has no community equivalent. It stays on the AT Store listing.",
        },
        {
          code: "no_community_equivalent",
          sourcePath: "links[2].type",
          message:
            'Link type "blog" has no community link role, so link 3 is kept without one.',
        },
      ]);
    });

    it("includes the product account for a profile", () => {
      const result = convertListingToCommunityApp(listing, "app.profile", {
        imageAlt,
      });

      expect(result.ok).toBe(true);
      expect(result.unmapped.map((field) => field.sourcePath)).toStrictEqual([
        "slug",
        "categorySlug",
        "migratedFromAtUri",
        "game",
        "productAccountDid",
        "links[2].type",
      ]);
    });

    it("is still listed when the conversion is blocked", () => {
      const result = convertListingToCommunityApp(listing, "app.entry");

      expect(result.ok).toBe(false);
      expect(result.unmapped.map((field) => field.sourcePath)).toStrictEqual([
        "slug",
        "categorySlug",
        "migratedFromAtUri",
        "game",
        "links[2].type",
      ]);
    });

    it("does not copy the placeholder AT Store writes for a missing tagline", () => {
      const result = convertListingToCommunityApp(
        { ...listing, tagline: "—" },
        "app.entry",
        { imageAlt },
      );

      expect(recordOf(result)).not.toHaveProperty("description");
      expect(result.unmapped).toContainEqual({
        code: "placeholder_tagline",
        sourcePath: "tagline",
        message:
          'The tagline is the "—" placeholder AT Store writes when a listing has none, so no description is set.',
      });
    });
  });

  describe("image alt text", () => {
    it("names the image that lacks it", () => {
      const result = convertListingToCommunityApp(
        { ...listing, heroImage: undefined },
        "app.entry",
        {
          imageAlt: {
            icon: "An open book on a blue square",
            screenshots: ["The reading list with three unread feeds"],
          },
        },
      );

      expect(problemsOf(result)).toStrictEqual([
        {
          code: "missing_image_alt",
          sourcePath: "screenshots[1]",
          targetPath: "images[2].alt",
          message: "Screenshot 2 needs alt text.",
        },
      ]);
    });

    it("is asked for on every image when none is supplied", () => {
      const result = convertListingToCommunityApp(listing, "app.entry");

      expect(problemsOf(result)).toStrictEqual([
        {
          code: "missing_image_alt",
          sourcePath: "icon",
          targetPath: "images[0].alt",
          message: "The icon needs alt text.",
        },
        {
          code: "missing_image_alt",
          sourcePath: "heroImage",
          targetPath: "images[1].alt",
          message: "The hero image needs alt text.",
        },
        {
          code: "missing_image_alt",
          sourcePath: "screenshots[0]",
          targetPath: "images[2].alt",
          message: "Screenshot 1 needs alt text.",
        },
        {
          code: "missing_image_alt",
          sourcePath: "screenshots[1]",
          targetPath: "images[3].alt",
          message: "Screenshot 2 needs alt text.",
        },
      ]);
    });

    it("counts as missing when it is blank", () => {
      const result = convertListingToCommunityApp(listing, "app.entry", {
        imageAlt: { ...imageAlt, heroImage: "   " },
      });

      expect(problemsOf(result)).toMatchObject([
        { code: "missing_image_alt", sourcePath: "heroImage" },
      ]);
    });
  });

  describe.each([
    {
      field: "name",
      sourcePath: "name",
      targetPath: "name",
      maxGraphemes: 100,
      maxBytes: 200,
      convert: (text: string) =>
        convertListingToCommunityApp({ ...listing, name: text }, "app.entry", {
          imageAlt,
        }),
      read: (result: CommunityAppConversion) => recordOf(result).name,
    },
    {
      field: "tagline",
      sourcePath: "tagline",
      targetPath: "description",
      maxGraphemes: 300,
      maxBytes: 3000,
      convert: (text: string) =>
        convertListingToCommunityApp(
          { ...listing, tagline: text },
          "app.entry",
          { imageAlt },
        ),
      read: (result: CommunityAppConversion) => recordOf(result).description,
    },
    {
      field: "description",
      sourcePath: "description",
      targetPath: "longDescription",
      maxGraphemes: 4000,
      maxBytes: 40_000,
      convert: (text: string) =>
        convertListingToCommunityApp(
          { ...listing, description: text },
          "app.entry",
          { imageAlt },
        ),
      read: (result: CommunityAppConversion) =>
        recordOf(result).longDescription,
    },
    {
      field: "tag",
      sourcePath: "appTags[1]",
      targetPath: "tags[1]",
      maxGraphemes: 32,
      maxBytes: 64,
      convert: (text: string) =>
        convertListingToCommunityApp(
          { ...listing, appTags: ["reader", text] },
          "app.entry",
          { imageAlt },
        ),
      read: (result: CommunityAppConversion) => recordOf(result).tags?.[1],
    },
    {
      field: "link label",
      sourcePath: "links[0].label",
      targetPath: "links[1].label",
      maxGraphemes: 50,
      maxBytes: 100,
      convert: (text: string) =>
        convertListingToCommunityApp(
          {
            ...listing,
            links: [
              { type: "docs", url: "https://reader.example/docs", label: text },
            ],
          },
          "app.entry",
          { imageAlt },
        ),
      read: (result: CommunityAppConversion) =>
        recordOf(result).links[1]?.label,
    },
    {
      field: "image alt text",
      sourcePath: "icon",
      targetPath: "images[0].alt",
      maxGraphemes: 300,
      maxBytes: 1000,
      convert: (text: string) =>
        convertListingToCommunityApp(listing, "app.entry", {
          imageAlt: { ...imageAlt, icon: text },
        }),
      read: (result: CommunityAppConversion) =>
        recordOf(result).images?.[0]?.alt,
    },
  ])(
    "$field length",
    ({ sourcePath, targetPath, maxGraphemes, maxBytes, convert, read }) => {
      it(`carries ${maxGraphemes} characters whole`, () => {
        const text = characters(maxGraphemes);

        expect(read(convert(text))).toBe(text);
      });

      it(`reports ${maxGraphemes + 1} characters`, () => {
        const result = convert(characters(maxGraphemes + 1));

        expect(problemsOf(result)).toMatchObject([
          {
            code: "too_many_graphemes",
            sourcePath,
            targetPath,
            actual: maxGraphemes + 1,
            allowed: maxGraphemes,
          },
        ]);
      });

      it(`carries ${maxBytes} bytes whole`, () => {
        const text = bytes(maxBytes);

        expect(read(convert(text))).toBe(text);
      });

      it(`reports ${maxBytes + 1} bytes`, () => {
        const result = convert(bytes(maxBytes + 1));

        expect(problemsOf(result)).toMatchObject([
          {
            code: "too_many_bytes",
            sourcePath,
            targetPath,
            actual: maxBytes + 1,
            allowed: maxBytes,
          },
        ]);
      });
    },
  );

  it("reports both limits when a text is over both", () => {
    const result = convertListingToCommunityApp(
      { ...listing, name: characters(201) },
      "app.entry",
      { imageAlt },
    );

    expect(problemsOf(result)).toStrictEqual([
      {
        code: "too_many_graphemes",
        sourcePath: "name",
        targetPath: "name",
        message: "The name has 201 characters; the limit is 100.",
        actual: 201,
        allowed: 100,
      },
      {
        code: "too_many_bytes",
        sourcePath: "name",
        targetPath: "name",
        message: "The name takes 201 bytes; the limit is 200.",
        actual: 201,
        allowed: 200,
      },
    ]);
  });

  describe("tag count", () => {
    it("carries 10 tags", () => {
      const result = convertListingToCommunityApp(
        { ...listing, appTags: tags(10) },
        "app.entry",
        { imageAlt },
      );

      expect(recordOf(result).tags).toStrictEqual(tags(10));
    });

    it("reports 11 tags", () => {
      const result = convertListingToCommunityApp(
        { ...listing, appTags: tags(11) },
        "app.entry",
        { imageAlt },
      );

      expect(problemsOf(result)).toStrictEqual([
        {
          code: "too_many_items",
          sourcePath: "appTags",
          targetPath: "tags",
          message: "The listing has 11 tags; the limit is 10.",
          actual: 11,
          allowed: 10,
        },
      ]);
    });
  });

  describe("link count", () => {
    it("carries the website and 11 other links", () => {
      const result = convertListingToCommunityApp(
        { ...listing, links: otherLinks(11) },
        "app.entry",
        { imageAlt },
      );

      expect(recordOf(result).links).toHaveLength(12);
    });

    it("reports the website and 12 other links", () => {
      const result = convertListingToCommunityApp(
        { ...listing, links: otherLinks(12) },
        "app.entry",
        { imageAlt },
      );

      expect(problemsOf(result)).toStrictEqual([
        {
          code: "too_many_items",
          sourcePath: "links",
          targetPath: "links",
          message:
            "The website and 12 other links make 13 links; the limit is 12.",
          actual: 13,
          allowed: 12,
        },
      ]);
    });
  });

  describe("image count", () => {
    it("carries 24 images", () => {
      const result = convertListingToCommunityApp(
        { ...listing, screenshots: screenshots(22) },
        "app.entry",
        { imageAlt: { ...imageAlt, screenshots: screenshotAlts(22) } },
      );

      expect(recordOf(result).images).toHaveLength(24);
    });

    it("reports 25 images", () => {
      const result = convertListingToCommunityApp(
        { ...listing, screenshots: screenshots(23) },
        "app.entry",
        { imageAlt: { ...imageAlt, screenshots: screenshotAlts(23) } },
      );

      expect(problemsOf(result)).toStrictEqual([
        {
          code: "too_many_items",
          sourcePath: "screenshots",
          targetPath: "images",
          message: "The listing has 25 images; the limit is 24.",
          actual: 25,
          allowed: 24,
        },
      ]);
    });
  });

  describe("image blobs", () => {
    it("carries a 2,000,000-byte image", () => {
      const result = convertListingToCommunityApp(
        { ...listing, heroImage: blob(HERO_CID, 2_000_000, "image/jpeg") },
        "app.entry",
        { imageAlt },
      );

      expect(recordOf(result).images?.[1]?.image.size).toBe(2_000_000);
    });

    it("reports a 2,000,001-byte image", () => {
      const result = convertListingToCommunityApp(
        { ...listing, heroImage: blob(HERO_CID, 2_000_001, "image/jpeg") },
        "app.entry",
        { imageAlt },
      );

      expect(problemsOf(result)).toStrictEqual([
        {
          code: "image_too_large",
          sourcePath: "heroImage",
          targetPath: "images[1].image",
          message: "The hero image is 2000001 bytes; the limit is 2000000.",
          actual: 2_000_001,
          allowed: 2_000_000,
        },
      ]);
    });

    it.each([
      ["a legacy blob with no size", { cid: ICON_CID, mimeType: "image/png" }],
      ["a file that is not an image", blob(ICON_CID, 48_000, "text/html")],
      ["a blob with no CID", { $type: "blob", mimeType: "image/png", size: 1 }],
    ])("reports %s", (_name, icon) => {
      const result = convertListingToCommunityApp(
        { ...listing, icon: icon as AtprotoBlob },
        "app.entry",
        { imageAlt },
      );

      expect(problemsOf(result)).toStrictEqual([
        {
          code: "invalid_image",
          sourcePath: "icon",
          targetPath: "images[0].image",
          message: "The icon is not an image blob with a known size.",
        },
      ]);
    });
  });

  it("checks the product account only for an entry, where it is used", () => {
    const source = { ...listing, productAccountDid: "reader.example" };

    expect(
      problemsOf(
        convertListingToCommunityApp(source, "app.entry", { imageAlt }),
      ),
    ).toStrictEqual([
      {
        code: "invalid_did",
        sourcePath: "productAccountDid",
        targetPath: "profileDid",
        message: "The product account is not a valid DID.",
      },
    ]);
    expect(
      convertListingToCommunityApp(source, "app.profile", { imageAlt }).ok,
    ).toBe(true);
  });

  it("returns every problem at once", () => {
    const result = convertListingToCommunityApp(
      {
        ...listing,
        name: "  ",
        tagline: characters(301),
        externalUrl: "reader.example",
        heroImage: blob(HERO_CID, 2_000_001, "image/jpeg"),
        screenshots: [
          blob(SHOT_A_CID, 400_000),
          { cid: SHOT_B_CID, mimeType: "image/png" } as unknown as AtprotoBlob,
        ],
        appTags: [...tags(10), characters(33)],
        productAccountDid: "reader.example",
        links: [
          { type: "docs", url: "" },
          { type: "privacy", url: "/privacy" },
        ],
        createdAt: "2 March 2026",
        updatedAt: "2026-09-14",
      },
      "app.entry",
      { imageAlt: { icon: characters(301) } },
    );

    expect(result).not.toHaveProperty("record");
    expect(
      problemsOf(result).map((problem) => [
        problem.code,
        problem.sourcePath,
        problem.targetPath,
      ]),
    ).toStrictEqual([
      ["missing_required_field", "name", "name"],
      ["too_many_graphemes", "tagline", "description"],
      ["too_many_graphemes", "icon", "images[0].alt"],
      ["image_too_large", "heroImage", "images[1].image"],
      ["missing_image_alt", "heroImage", "images[1].alt"],
      ["missing_image_alt", "screenshots[0]", "images[2].alt"],
      ["invalid_image", "screenshots[1]", "images[3].image"],
      ["missing_image_alt", "screenshots[1]", "images[3].alt"],
      ["too_many_items", "appTags", "tags"],
      ["too_many_graphemes", "appTags[10]", "tags[10]"],
      ["invalid_did", "productAccountDid", "profileDid"],
      ["invalid_uri", "externalUrl", "links[0].uri"],
      ["missing_required_field", "links[0].url", "links[1].uri"],
      ["invalid_uri", "links[1].url", "links[2].uri"],
      ["invalid_datetime", "createdAt", "createdAt"],
      ["invalid_datetime", "updatedAt", "updatedAt"],
    ]);
  });

  it("reports a listing with no website or created date", () => {
    const result = convertListingToCommunityApp(
      { ...listing, externalUrl: "", createdAt: "" },
      "app.profile",
      { imageAlt },
    );

    expect(problemsOf(result)).toStrictEqual([
      {
        code: "missing_required_field",
        sourcePath: "externalUrl",
        targetPath: "links[0].uri",
        message: "The listing needs a website address.",
      },
      {
        code: "missing_required_field",
        sourcePath: "createdAt",
        targetPath: "createdAt",
        message: "The listing needs a created date.",
      },
    ]);
  });

  it("leaves the listing and the alt text as they were", () => {
    const before = JSON.stringify({ listing, imageAlt });

    const entry = convertListingToCommunityApp(listing, "app.entry", {
      imageAlt,
    });
    convertListingToCommunityApp(listing, "app.profile", { imageAlt });
    // A blocked conversion must leave its input alone too.
    convertListingToCommunityApp(listing, "app.entry");

    expect(JSON.stringify({ listing, imageAlt })).toBe(before);

    // The record is a separate object throughout, so editing it later cannot reach the listing.
    const record = recordOf(entry);
    expect(record.tags).not.toBe(listing.appTags);
    expect(record.images?.[0]?.image).not.toBe(listing.icon);
    expect(record.images?.[0]?.image.ref).not.toBe(listing.icon.ref);
    expect(record.links[1]).not.toBe(listing.links?.[0]);
  });
});
