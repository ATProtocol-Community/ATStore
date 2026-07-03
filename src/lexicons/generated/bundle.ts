export const lexicons = [
  {
    "lexicon": 1,
    "id": "fyi.atstore.authBasic",
    "description": "Permission set for AT Store write access.",
    "defs": {
      "main": {
        "type": "permission-set",
        "title": "Full AT Store Access",
        "detail": "Provides full access to AT Store profile, listings, reviews, and favorites.",
        "permissions": [
          {
            "type": "permission",
            "resource": "repo",
            "collection": [
              "fyi.atstore.profile",
              "fyi.atstore.listing.detail",
              "fyi.atstore.listing.review",
              "fyi.atstore.listing.reviewReply",
              "fyi.atstore.listing.favorite"
            ],
            "action": [
              "create",
              "update",
              "delete"
            ]
          }
        ]
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.authReviewer",
    "description": "Permission set for AT Store reviewer access.",
    "defs": {
      "main": {
        "type": "permission-set",
        "title": "ATStore Reviewer",
        "detail": "Provides AT Store access limited to profile and review records.",
        "permissions": [
          {
            "type": "permission",
            "resource": "repo",
            "collection": [
              "fyi.atstore.profile",
              "fyi.atstore.listing.review"
            ],
            "action": [
              "create",
              "update",
              "delete"
            ]
          }
        ]
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.authThirdPartyReviews",
    "description": "OAuth permission bundle for third-party apps that publish AT Store profile self plus listing reviews on the user's repo; reads use public directory XRPC.",
    "defs": {
      "main": {
        "type": "permission-set",
        "title": "Submit AT Store reviews",
        "detail": "Create fyi.atstore.profile/self when needed and fyi.atstore.listing.review records on the user's PDS via repository APIs; read public directory data via XRPC queries.",
        "permissions": [
          {
            "type": "permission",
            "resource": "repo",
            "collection": [
              "fyi.atstore.profile"
            ],
            "action": [
              "create"
            ]
          },
          {
            "type": "permission",
            "resource": "repo",
            "collection": [
              "fyi.atstore.listing.review"
            ],
            "action": [
              "create"
            ]
          }
        ]
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.directory.getListing",
    "defs": {
      "listingCardGet": {
        "type": "object",
        "required": [
          "uri",
          "name",
          "tagline",
          "description",
          "category",
          "accent",
          "reviewCount",
          "priceLabel",
          "appTags",
          "categorySlugs"
        ],
        "nullable": [
          "iconUrl",
          "heroImageUrl",
          "categorySlug",
          "rating",
          "productAccountHandle"
        ],
        "properties": {
          "uri": {
            "type": "string",
            "format": "at-uri",
            "maxLength": 2560,
            "description": "AT URI of the fyi.atstore.listing.detail record."
          },
          "name": {
            "type": "string",
            "maxLength": 640
          },
          "tagline": {
            "type": "string",
            "maxLength": 2000
          },
          "description": {
            "type": "string",
            "maxLength": 20000
          },
          "iconUrl": {
            "type": "string",
            "maxLength": 8192
          },
          "heroImageUrl": {
            "type": "string",
            "maxLength": 8192
          },
          "categorySlug": {
            "type": "string",
            "maxLength": 512
          },
          "categorySlugs": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 512
            }
          },
          "category": {
            "type": "string",
            "maxLength": 640
          },
          "accent": {
            "type": "string",
            "maxLength": 16,
            "knownValues": [
              "blue",
              "pink",
              "purple",
              "green"
            ]
          },
          "rating": {
            "type": "string",
            "maxLength": 16
          },
          "reviewCount": {
            "type": "integer"
          },
          "priceLabel": {
            "type": "string",
            "maxLength": 32
          },
          "productAccountHandle": {
            "type": "string",
            "maxLength": 512
          },
          "appTags": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 256
            }
          }
        }
      },
      "listingLinkRow": {
        "type": "object",
        "required": [
          "uri"
        ],
        "properties": {
          "label": {
            "type": "string",
            "maxLength": 640
          },
          "uri": {
            "type": "string",
            "maxLength": 2048
          }
        }
      },
      "listingDetailResponse": {
        "type": "object",
        "required": [
          "listing",
          "isStoreManaged"
        ],
        "nullable": [
          "repoDid",
          "productAccountDid",
          "sourceTagline",
          "sourceFullDescription",
          "externalUrl",
          "sourceUrl",
          "createdAt",
          "updatedAt"
        ],
        "properties": {
          "listing": {
            "type": "ref",
            "ref": "#listingCardGet"
          },
          "isStoreManaged": {
            "type": "boolean"
          },
          "repoDid": {
            "type": "string",
            "maxLength": 2048
          },
          "productAccountDid": {
            "type": "string",
            "maxLength": 2048
          },
          "sourceTagline": {
            "type": "string",
            "maxLength": 20000
          },
          "sourceFullDescription": {
            "type": "string",
            "maxLength": 20000
          },
          "screenshots": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 4096
            }
          },
          "externalUrl": {
            "type": "string",
            "maxLength": 2048
          },
          "sourceUrl": {
            "type": "string",
            "maxLength": 8192
          },
          "createdAt": {
            "type": "string",
            "maxLength": 64
          },
          "updatedAt": {
            "type": "string",
            "maxLength": 64
          },
          "links": {
            "type": "array",
            "items": {
              "type": "ref",
              "ref": "#listingLinkRow"
            }
          }
        }
      },
      "main": {
        "type": "query",
        "description": "Fetch one public verified listing. Provide exactly one of `uri` (fyi.atstore.listing.detail AT URI) or `externalUrl` (unique storefront URL); `externalUrl` uses the same matching rules as the former resolve endpoint.",
        "parameters": {
          "type": "params",
          "properties": {
            "uri": {
              "type": "string",
              "format": "at-uri",
              "maxLength": 2560,
              "description": "AT URI of the fyi.atstore.listing.detail record."
            },
            "externalUrl": {
              "type": "string",
              "maxLength": 2048,
              "description": "Listing external_url / product URL as stored on the record; must match at most one public listing."
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "ref",
            "ref": "#listingDetailResponse"
          }
        },
        "errors": [
          {
            "name": "ListingNotFound"
          },
          {
            "name": "InvalidParams"
          },
          {
            "name": "AmbiguousResolution"
          }
        ]
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.directory.searchListings",
    "defs": {
      "listingCardSearch": {
        "type": "object",
        "required": [
          "uri",
          "name",
          "tagline",
          "description",
          "category",
          "accent",
          "reviewCount",
          "priceLabel",
          "appTags",
          "categorySlugs"
        ],
        "nullable": [
          "iconUrl",
          "heroImageUrl",
          "categorySlug",
          "rating",
          "productAccountHandle"
        ],
        "properties": {
          "uri": {
            "type": "string",
            "format": "at-uri",
            "maxLength": 2560,
            "description": "AT URI of the fyi.atstore.listing.detail record."
          },
          "name": {
            "type": "string",
            "maxLength": 640
          },
          "tagline": {
            "type": "string",
            "maxLength": 2000
          },
          "description": {
            "type": "string",
            "maxLength": 20000
          },
          "iconUrl": {
            "type": "string",
            "maxLength": 8192
          },
          "heroImageUrl": {
            "type": "string",
            "maxLength": 8192
          },
          "categorySlug": {
            "type": "string",
            "maxLength": 512
          },
          "categorySlugs": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 512
            }
          },
          "category": {
            "type": "string",
            "maxLength": 640
          },
          "accent": {
            "type": "string",
            "maxLength": 16,
            "knownValues": [
              "blue",
              "pink",
              "purple",
              "green"
            ]
          },
          "rating": {
            "type": "string",
            "maxLength": 16
          },
          "reviewCount": {
            "type": "integer"
          },
          "priceLabel": {
            "type": "string",
            "maxLength": 32
          },
          "productAccountHandle": {
            "type": "string",
            "maxLength": 512
          },
          "appTags": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 256
            }
          }
        }
      },
      "main": {
        "type": "query",
        "description": "Directory listing search and pagination (verified listings with a listing.detail AT URI only).",
        "parameters": {
          "type": "params",
          "properties": {
            "q": {
              "type": "string",
              "maxLength": 512
            },
            "sort": {
              "type": "string",
              "maxLength": 24,
              "default": "popular",
              "enum": [
                "popular",
                "newest",
                "alphabetical"
              ]
            },
            "limit": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 24
            },
            "cursor": {
              "type": "string",
              "maxLength": 512
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "listings"
            ],
            "properties": {
              "cursor": {
                "type": "string",
                "maxLength": 512
              },
              "listings": {
                "type": "array",
                "items": {
                  "type": "ref",
                  "ref": "#listingCardSearch"
                }
              }
            }
          }
        },
        "errors": [
          {
            "name": "InvalidCursor"
          }
        ]
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.listing.detail",
    "defs": {
      "main": {
        "type": "record",
        "description": "Public protocol or app listing in the AT Store directory. Images are stored as repo blobs (Kitchen-style); the web app caches HTTPS URLs in Postgres separately.",
        "key": "tid",
        "record": {
          "type": "object",
          "required": [
            "slug",
            "name",
            "tagline",
            "externalUrl",
            "icon",
            "categorySlug",
            "createdAt",
            "updatedAt"
          ],
          "properties": {
            "slug": {
              "type": "string",
              "minLength": 1,
              "maxLength": 512,
              "description": "Stable URL slug; unique within the publishing account."
            },
            "name": {
              "type": "string",
              "maxLength": 640
            },
            "tagline": {
              "type": "string",
              "maxLength": 300
            },
            "description": {
              "type": "string",
              "maxLength": 20000
            },
            "externalUrl": {
              "type": "string",
              "format": "uri",
              "maxLength": 2048,
              "description": "Primary product or project URL."
            },
            "icon": {
              "type": "blob",
              "accept": [
                "image/png",
                "image/jpeg",
                "image/webp",
                "image/gif",
                "image/svg+xml"
              ],
              "maxSize": 2000000,
              "description": "Square / app icon (uploaded to repo via com.atproto.repo.uploadBlob)."
            },
            "heroImage": {
              "type": "blob",
              "accept": [
                "image/png",
                "image/jpeg",
                "image/webp",
                "image/gif",
                "image/svg+xml"
              ],
              "maxSize": 12000000,
              "description": "Hero / cover image blob."
            },
            "screenshots": {
              "type": "array",
              "maxLength": 20,
              "items": {
                "type": "blob",
                "accept": [
                  "image/png",
                  "image/jpeg",
                  "image/webp",
                  "image/gif",
                  "image/svg+xml"
                ],
                "maxSize": 12000000
              }
            },
            "categorySlug": {
              "type": "array",
              "minLength": 1,
              "maxLength": 32,
              "items": {
                "type": "string",
                "maxLength": 256
              },
              "description": "Browse category keys (e.g. protocol/pds). First entry is the primary category for legacy surfaces."
            },
            "createdAt": {
              "type": "string",
              "format": "datetime"
            },
            "updatedAt": {
              "type": "string",
              "format": "datetime"
            },
            "appTags": {
              "type": "array",
              "maxLength": 64,
              "items": {
                "type": "string",
                "maxLength": 96
              }
            },
            "productAccountDid": {
              "type": "string",
              "maxLength": 2048,
              "description": "Bluesky DID for the product, app, or tool (not the AT Store publisher). Handle is resolved and stored in Postgres only."
            },
            "migratedFromAtUri": {
              "type": "string",
              "format": "at-uri",
              "maxLength": 8192,
              "description": "When this listing.detail record supersedes a prior record in another repo (e.g. moved from the AT Store publisher to a product owner PDS), the at:// URI of that prior fyi.atstore.listing.detail record."
            },
            "links": {
              "type": "array",
              "maxLength": 12,
              "description": "Relevant links for the app, including trust/compliance, support, and project resources.",
              "items": {
                "type": "ref",
                "ref": "#link"
              }
            }
          }
        }
      },
      "link": {
        "type": "object",
        "required": [
          "type",
          "url"
        ],
        "properties": {
          "type": {
            "type": "string",
            "maxLength": 32,
            "knownValues": [
              "privacy",
              "terms",
              "support",
              "contact",
              "docs",
              "blog",
              "changelog",
              "source",
              "status",
              "community",
              "donate",
              "license",
              "other"
            ],
            "description": "The kind of link."
          },
          "url": {
            "type": "string",
            "format": "uri",
            "maxLength": 2048,
            "description": "The destination URL."
          },
          "label": {
            "type": "string",
            "maxLength": 100,
            "maxGraphemes": 50,
            "description": "Optional human-readable label, especially useful when type is 'other'."
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.listing.favorite",
    "defs": {
      "main": {
        "type": "record",
        "description": "A user favorite for an AT Store listing. Subject must be the at:// URI of a fyi.atstore.listing.detail record.",
        "key": "any",
        "record": {
          "type": "object",
          "required": [
            "subject",
            "createdAt"
          ],
          "properties": {
            "subject": {
              "type": "string",
              "format": "at-uri",
              "description": "AT URI of the fyi.atstore.listing.detail record being favorited."
            },
            "createdAt": {
              "type": "string",
              "format": "datetime"
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.listing.review",
    "defs": {
      "main": {
        "type": "record",
        "description": "A user review of an AT Store directory listing. Subject must be the at:// URI of a fyi.atstore.listing.detail record.",
        "key": "tid",
        "record": {
          "type": "object",
          "required": [
            "subject",
            "rating",
            "createdAt"
          ],
          "properties": {
            "subject": {
              "type": "string",
              "format": "at-uri",
              "description": "AT URI of the fyi.atstore.listing.detail record being reviewed."
            },
            "rating": {
              "type": "integer",
              "minimum": 1,
              "maximum": 5,
              "description": "Star rating 1–5."
            },
            "text": {
              "type": "string",
              "maxLength": 8000,
              "description": "Optional written review; omit for a stars-only rating."
            },
            "createdAt": {
              "type": "string",
              "format": "datetime"
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.listing.reviewReply",
    "defs": {
      "main": {
        "type": "record",
        "description": "A reply on a fyi.atstore.listing.review. Threads are linear (no per-reply parent). By convention, only the listing owner or the review author should post replies; the AT Store app drops replies from any other DID at ingest and at render. The PDS does not enforce this — other indexers MAY surface unauthorized replies if they choose.",
        "key": "tid",
        "record": {
          "type": "object",
          "required": [
            "subject",
            "text",
            "createdAt"
          ],
          "properties": {
            "subject": {
              "type": "string",
              "format": "at-uri",
              "description": "AT URI of the fyi.atstore.listing.review this reply belongs to."
            },
            "text": {
              "type": "string",
              "minLength": 1,
              "maxLength": 8000
            },
            "createdAt": {
              "type": "string",
              "format": "datetime"
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.profile",
    "defs": {
      "main": {
        "type": "record",
        "description": "AT Store app profile for discovery and TAP ingestion (Kitchen-style).",
        "key": "literal:self",
        "record": {
          "type": "object",
          "required": [
            "displayName"
          ],
          "properties": {
            "displayName": {
              "type": "string",
              "maxLength": 640,
              "description": "Human-readable name for the store / app."
            },
            "description": {
              "type": "string",
              "maxLength": 4000,
              "description": "Longer description shown in directory surfaces."
            },
            "website": {
              "type": "string",
              "format": "uri",
              "maxLength": 2048
            }
          }
        }
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.reviews.listForListing",
    "defs": {
      "listingReviewView": {
        "type": "object",
        "required": [
          "id",
          "authorDid",
          "rating",
          "reviewCreatedAt",
          "replyCount",
          "canReply"
        ],
        "nullable": [
          "text",
          "authorDisplayName",
          "authorHandle",
          "authorAvatarUrl"
        ],
        "properties": {
          "id": {
            "type": "string",
            "maxLength": 64
          },
          "authorDid": {
            "type": "string",
            "format": "did",
            "maxLength": 2048
          },
          "rating": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "text": {
            "type": "string",
            "maxLength": 8000
          },
          "reviewCreatedAt": {
            "type": "string",
            "format": "datetime",
            "maxLength": 64
          },
          "authorDisplayName": {
            "type": "string",
            "maxLength": 640
          },
          "authorHandle": {
            "type": "string",
            "maxLength": 512
          },
          "authorAvatarUrl": {
            "type": "string",
            "maxLength": 8192
          },
          "replyCount": {
            "type": "integer"
          },
          "canReply": {
            "type": "boolean"
          }
        }
      },
      "main": {
        "type": "query",
        "description": "List reviews for a directory listing (mirrored Tap data plus profile enrichment).",
        "parameters": {
          "type": "params",
          "required": [
            "uri"
          ],
          "properties": {
            "uri": {
              "type": "string",
              "format": "at-uri",
              "maxLength": 2560,
              "description": "AT URI of the fyi.atstore.listing.detail record."
            },
            "limit": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 50
            },
            "cursor": {
              "type": "string",
              "maxLength": 512
            }
          }
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "reviews"
            ],
            "properties": {
              "cursor": {
                "type": "string",
                "maxLength": 512
              },
              "reviews": {
                "type": "array",
                "items": {
                  "type": "ref",
                  "ref": "#listingReviewView"
                }
              }
            }
          }
        },
        "errors": [
          {
            "name": "ListingNotFound"
          },
          {
            "name": "InvalidParams"
          },
          {
            "name": "InvalidCursor"
          }
        ]
      }
    }
  },
  {
    "lexicon": 1,
    "id": "fyi.atstore.server.describe",
    "defs": {
      "main": {
        "type": "query",
        "description": "Describe this deployment's public XRPC surface and defaults.",
        "parameters": {
          "type": "params",
          "properties": {}
        },
        "output": {
          "encoding": "application/json",
          "schema": {
            "type": "object",
            "required": [
              "service",
              "publicReads",
              "reviewsWrittenOnAuthorRepo",
              "defaultListingLimit",
              "maxListingLimit",
              "maxReviewLimit",
              "methods"
            ],
            "properties": {
              "service": {
                "type": "string",
                "maxLength": 256
              },
              "publicReads": {
                "type": "boolean"
              },
              "reviewsWrittenOnAuthorRepo": {
                "type": "boolean",
                "description": "When true, listing reviews are created via com.atproto.repo.createRecord on the author's PDS (fyi.atstore.listing.review); this service does not expose a write procedure for reviews."
              },
              "defaultListingLimit": {
                "type": "integer"
              },
              "maxListingLimit": {
                "type": "integer"
              },
              "maxReviewLimit": {
                "type": "integer"
              },
              "methods": {
                "type": "array",
                "items": {
                  "type": "string",
                  "maxLength": 512
                }
              }
            }
          }
        }
      }
    }
  }
]
