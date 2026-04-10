# Examples

## Minimal manual entry

```bash
npm run listing:add -- \
  --name "Example PDS" \
  --source-url "https://example.com" \
  --external-url "https://example.com" \
  --category-slug "protocol/pds" \
  --tagline "Hosted AT Protocol accounts for teams." \
  --description "Example PDS provides managed AT Protocol hosting for organizations that want portable identity and data." \
  --raw-category-hint "PDS" \
  --scope "atproto" \
  --product-type "service" \
  --domain "hosting" \
  --classification-reason "Managed AT Protocol hosting that acts as a PDS."
```

## With asset downloads

```bash
npm run listing:add -- \
  --name "Example PDS" \
  --source-url "https://example.com" \
  --external-url "https://example.com" \
  --category-slug "protocol/pds" \
  --tagline "Hosted AT Protocol accounts for teams." \
  --description "Example PDS provides managed AT Protocol hosting for organizations that want portable identity and data." \
  --raw-category-hint "PDS" \
  --scope "atproto" \
  --product-type "service" \
  --domain "hosting" \
  --classification-reason "Managed AT Protocol hosting that acts as a PDS." \
  --icon-asset-url "https://example.com/logo.png" \
  --screenshot-asset-url "https://example.com/og-image.png"
```

## Dry run

```bash
npm run listing:add -- \
  --name "Example PDS" \
  --source-url "https://example.com" \
  --category-slug "protocol/pds" \
  --dry-run \
  --no-import
```

## Eurosky example

```bash
npm run listing:add -- \
  --name "Eurosky" \
  --source-url "https://www.eurosky.tech/eurosky-accounts" \
  --external-url "https://www.eurosky.tech/eurosky-accounts" \
  --category-slug "protocol/pds" \
  --tagline "European-hosted AT Protocol accounts that act as your PDS and work across Bluesky, Flashes, Tangled, and other Atmosphere apps." \
  --description "Eurosky offers European-hosted eurosky.social accounts built on the AT Protocol. Each account acts as a personal data server (PDS), so your identity, posts, and social graph stay portable across apps while remaining governed under European law and infrastructure." \
  --raw-category-hint "PDS" \
  --scope "atproto" \
  --product-type "service" \
  --domain "hosting" \
  --classification-reason "Eurosky provides hosted AT Protocol accounts whose eurosky.social identity acts as a personal data server, so it belongs in the protocol/PDS category." \
  --icon-url "/generated/listings/eurosky-icon.svg" \
  --screenshot-url "/generated/listings/eurosky-og-image.png"
```
