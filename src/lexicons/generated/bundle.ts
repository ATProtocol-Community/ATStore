export const lexicons = [
  {
    lexicon: 1,
    id: "fyi.atstore.authBasic",
    description: "Permission set for AT Store write access.",
    defs: {
      main: {
        type: "permission-set",
        title: "Full AT Store Access",
        detail:
          "Provides full access to AT Store profile, listings, reviews, and favorites.",
        permissions: [
          {
            type: "permission",
            resource: "repo",
            collection: [
              "fyi.atstore.profile",
              "fyi.atstore.listing.detail",
              "fyi.atstore.listing.review",
              "fyi.atstore.listing.favorite",
            ],
            action: ["create", "update", "delete"],
          },
        ],
      },
    },
  },
  {
    lexicon: 1,
    id: "fyi.atstore.listing.detail",
    defs: {
      main: {
        type: "record",
        description:
          "Public protocol or app listing in the AT Store directory. Images are stored as repo blobs (Kitchen-style); the web app caches HTTPS URLs in Postgres separately.",
        key: "tid",
        record: {
          type: "object",
          required: [
            "slug",
            "name",
            "tagline",
            "externalUrl",
            "icon",
            "categorySlug",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            slug: {
              type: "string",
              minLength: 1,
              maxLength: 512,
              description:
                "Stable URL slug; unique within the publishing account.",
            },
            name: {
              type: "string",
              maxLength: 640,
            },
            tagline: {
              type: "string",
              maxLength: 300,
            },
            description: {
              type: "string",
              maxLength: 20_000,
            },
            externalUrl: {
              type: "string",
              format: "uri",
              maxLength: 2048,
              description: "Primary product or project URL.",
            },
            icon: {
              type: "blob",
              accept: [
                "image/png",
                "image/jpeg",
                "image/webp",
                "image/gif",
                "image/svg+xml",
              ],
              maxSize: 2_000_000,
              description:
                "Square / app icon (uploaded to repo via com.atproto.repo.uploadBlob).",
            },
            heroImage: {
              type: "blob",
              accept: [
                "image/png",
                "image/jpeg",
                "image/webp",
                "image/gif",
                "image/svg+xml",
              ],
              maxSize: 12_000_000,
              description: "Hero / cover image blob.",
            },
            screenshots: {
              type: "array",
              maxLength: 20,
              items: {
                type: "blob",
                accept: [
                  "image/png",
                  "image/jpeg",
                  "image/webp",
                  "image/gif",
                  "image/svg+xml",
                ],
                maxSize: 12_000_000,
              },
            },
            categorySlug: {
              type: "array",
              minLength: 1,
              maxLength: 32,
              items: {
                type: "string",
                maxLength: 256,
              },
              description:
                "Browse category keys (e.g. protocol/pds). First entry is the primary category for legacy surfaces.",
            },
            createdAt: {
              type: "string",
              format: "datetime",
            },
            updatedAt: {
              type: "string",
              format: "datetime",
            },
            appTags: {
              type: "array",
              maxLength: 64,
              items: {
                type: "string",
                maxLength: 96,
              },
            },
            productAccountDid: {
              type: "string",
              maxLength: 2048,
              description:
                "Bluesky DID for the product, app, or tool (not the AT Store publisher). Handle is resolved and stored in Postgres only.",
            },
            migratedFromAtUri: {
              type: "string",
              format: "at-uri",
              maxLength: 8192,
              description:
                "When this listing.detail record supersedes a prior record in another repo (e.g. moved from the AT Store publisher to a product owner PDS), the at:// URI of that prior fyi.atstore.listing.detail record.",
            },
            links: {
              type: "array",
              maxLength: 12,
              description:
                "Relevant links for the app, including trust/compliance, support, and project resources.",
              items: {
                type: "ref",
                ref: "#link",
              },
            },
          },
        },
      },
      link: {
        type: "object",
        required: ["type", "url"],
        properties: {
          type: {
            type: "string",
            knownValues: [
              "privacy",
              "terms",
              "support",
              "contact",
              "docs",
              "blog",
              "changelog",
              "source",
              "status",
              "other",
            ],
            description: "The kind of link.",
          },
          url: {
            type: "string",
            format: "uri",
            description: "The destination URL.",
          },
          label: {
            type: "string",
            maxLength: 100,
            maxGraphemes: 50,
            description:
              "Optional human-readable label, especially useful when type is 'other'.",
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: "fyi.atstore.listing.favorite",
    defs: {
      main: {
        type: "record",
        description:
          "A user favorite for an AT Store listing. Subject must be the at:// URI of a fyi.atstore.listing.detail record.",
        key: "any",
        record: {
          type: "object",
          required: ["subject", "createdAt"],
          properties: {
            subject: {
              type: "string",
              format: "at-uri",
              description:
                "AT URI of the fyi.atstore.listing.detail record being favorited.",
            },
            createdAt: {
              type: "string",
              format: "datetime",
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: "fyi.atstore.listing.review",
    defs: {
      main: {
        type: "record",
        description:
          "A user review of an AT Store directory listing. Subject must be the at:// URI of a fyi.atstore.listing.detail record.",
        key: "tid",
        record: {
          type: "object",
          required: ["subject", "rating", "createdAt"],
          properties: {
            subject: {
              type: "string",
              format: "at-uri",
              description:
                "AT URI of the fyi.atstore.listing.detail record being reviewed.",
            },
            rating: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              description: "Star rating 1–5.",
            },
            text: {
              type: "string",
              maxLength: 8000,
              description:
                "Optional written review; omit for a stars-only rating.",
            },
            createdAt: {
              type: "string",
              format: "datetime",
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: "fyi.atstore.profile",
    defs: {
      main: {
        type: "record",
        description:
          "AT Store app profile for discovery and TAP ingestion (Kitchen-style).",
        key: "literal:self",
        record: {
          type: "object",
          required: ["displayName"],
          properties: {
            displayName: {
              type: "string",
              maxLength: 640,
              description: "Human-readable name for the store / app.",
            },
            description: {
              type: "string",
              maxLength: 4000,
              description: "Longer description shown in directory surfaces.",
            },
            website: {
              type: "string",
              format: "uri",
              maxLength: 2048,
            },
          },
        },
      },
    },
  },
];
