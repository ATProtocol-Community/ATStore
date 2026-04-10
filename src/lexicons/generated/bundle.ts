export const lexicons = [
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
            "heroImage",
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
  }
]
