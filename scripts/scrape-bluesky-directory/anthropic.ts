import Anthropic from "@anthropic-ai/sdk"

import {
  ALLOWED_DOMAINS,
  ALLOWED_PRODUCT_TYPES,
  ALLOWED_SCOPES,
  ALLOWED_VERTICALS,
  formatStructuredTaxonomyForPrompt,
  normalizeDomain,
  normalizeProductType,
  normalizeScope,
  normalizeVertical,
  type StructuredTaxonomy,
} from "./taxonomy.ts"

export type ClassificationResult = StructuredTaxonomy & {
  classificationReason: string
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514"

function getApiKey(): string {
  const key =
    process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_KEY ?? ""
  if (!key) {
    throw new Error(
      "Missing API key: set ANTHROPIC_API_KEY (or ANTHROPIC_KEY) in the environment.",
    )
  }
  return key
}

export async function classifyProduct(input: {
  name: string
  tagline: string | null
  fullDescription: string | null
  rawCategoryHint: string | null
  sourceUrl: string
  visitOutUrl: string
  externalUrl: string | null
}): Promise<ClassificationResult> {
  const client = new Anthropic({ apiKey: getApiKey() })
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL

  const taxonomy = formatStructuredTaxonomyForPrompt()
  const userPayload = {
    name: input.name,
    sourceUrl: input.sourceUrl,
    visitOutUrl: input.visitOutUrl,
    externalUrl: input.externalUrl,
    tagline: input.tagline,
    fullDescription: input.fullDescription,
    rawCategoryHint: input.rawCategoryHint,
  }

  const message = await client.messages.create({
    model,
    max_tokens: 512,
    temperature: 0,
    system: [
      {
        type: "text",
        text: `You classify Bluesky / AT Protocol related listings into a structured taxonomy record.

Rules:
- Return exactly one structured classification using the allowed enum values below.
- Use "atproto" scope for protocol-wide products that work across the AT Protocol ecosystem, self-hosted PDSs, or generic at:// / DID / lexicon / XRPC workflows.
- Use "bluesky" scope for products that are primarily specific to Bluesky itself, its official app UX, or Bluesky-only use cases.
- Use "cross_network" for bridges, multi-network clients, and integrations spanning Bluesky plus other ecosystems.
- Set "vertical" to null unless the product is clearly a vertical app with a meaningful subject-area specialization.
- Respond with JSON only, no markdown fences.

Allowed taxonomy values:
${taxonomy}

JSON schema:
{"scope":"<one allowed scope>","productType":"<one allowed product type>","domain":"<one allowed domain>","vertical":"<one allowed vertical or null>","classificationReason":"<short reason>"}`,
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify(userPayload),
          },
        ],
      },
    ],
  })

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("")
    .trim()

  const parsed = parseJsonObject(text)
  const rawScope = String(parsed.scope ?? "")
  const rawProductType = String(parsed.productType ?? "")
  const rawDomain = String(parsed.domain ?? "")
  const rawVertical = parsed.vertical == null ? null : String(parsed.vertical)
  const reason = String(parsed.classificationReason ?? "")

  const scope = normalizeScope(rawScope)
  if (!scope) {
    throw new Error(
      `Model returned invalid scope "${rawScope}". Allowed: ${ALLOWED_SCOPES.join(", ")}`,
    )
  }

  const productType = normalizeProductType(rawProductType)
  if (!productType) {
    throw new Error(
      `Model returned invalid productType "${rawProductType}". Allowed: ${ALLOWED_PRODUCT_TYPES.join(", ")}`,
    )
  }

  const domain = normalizeDomain(rawDomain)
  if (!domain) {
    throw new Error(
      `Model returned invalid domain "${rawDomain}". Allowed: ${ALLOWED_DOMAINS.join(", ")}`,
    )
  }

  const vertical = normalizeVertical(rawVertical)
  if (rawVertical !== null && vertical === null) {
    throw new Error(
      `Model returned invalid vertical "${rawVertical}". Allowed: ${ALLOWED_VERTICALS.join(", ")}, or null`,
    )
  }

  return {
    scope,
    productType,
    domain,
    vertical,
    classificationReason: reason,
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  const parsed: unknown = JSON.parse(slice)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object from model")
  }
  return parsed as Record<string, unknown>
}
