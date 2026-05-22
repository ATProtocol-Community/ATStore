/**
 * Display formatters shared by the server-side funding loader (`load-funding-summaries.ts`)
 * and the product-page funding popover chip (`<FundingPopoverChip/>`). Both used to carry
 * parallel copies — when at.fund ships a new payment-provider brand or frequency value,
 * this is the only place to update.
 */

/** Channel type labels per the at.fund `channelType` knownValues. */
export function formatChannelTypeLabel(channelType: string): string {
  switch (channelType) {
    case "payment-provider": {
      return "Payment provider";
    }
    case "bank": {
      return "Bank";
    }
    case "cheque": {
      return "Cheque";
    }
    case "cash": {
      return "Cash";
    }
    case "other": {
      return "Other";
    }
    default: {
      return channelType;
    }
  }
}

/**
 * Map a channel record to a brand-recognisable display name. The lexicon's `channelType`
 * is a coarse category ("payment-provider", "bank", …); for chip / pill UIs we prefer the
 * brand humans recognise ("Ko-fi", "Open Collective"). Falls back to:
 *
 *   1. the steward's short `description` (≤ 32 chars) when authored,
 *   2. the bare host of `channelUri` when it's a recognised brand or anything else,
 *   3. the `channelType` label otherwise.
 *
 * Pure / sync — safe to call from both server loaders and React components.
 */
export function deriveChannelLabel(input: {
  channelType: string;
  channelUri: string | null;
  description: string | null;
}): string {
  const desc = input.description?.trim();
  if (desc && desc.length <= 32) return desc;

  const uri = input.channelUri?.trim();
  if (uri) {
    try {
      const u = new URL(uri);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host.endsWith("github.com") && u.pathname.startsWith("/sponsors/")) {
        return "GitHub Sponsors";
      }
      if (host === "ko-fi.com") return "Ko-fi";
      if (host === "opencollective.com") return "Open Collective";
      if (host === "liberapay.com") return "Liberapay";
      if (host === "patreon.com") return "Patreon";
      if (host === "buymeacoffee.com") return "Buy Me a Coffee";
      if (host === "paypal.me" || host === "paypal.com") return "PayPal";
      if (host === "stripe.com") return "Stripe";
      // Bare host fallback (e.g. "example.com") still beats "Payment provider".
      return host;
    } catch {
      // fall through to channelType below
    }
  }
  return formatChannelTypeLabel(input.channelType);
}

/** Compact "/mo" / "/yr" suffix for plan prices, mirroring at.fund's UI. */
export function formatFrequencySuffix(frequency: string): string {
  switch (frequency) {
    case "weekly": {
      return "/wk";
    }
    case "fortnightly": {
      return "/2wk";
    }
    case "monthly": {
      return "/mo";
    }
    case "yearly": {
      return "/yr";
    }
    case "other": {
      return "";
    }
    default: {
      return ` / ${frequency}`;
    }
  }
}

/**
 * Format a plan amount for display. The lexicon stores `amount` as the smallest currency
 * unit (cents for USD); we convert to whole units. `0` means "any amount" per spec.
 * Returns null when `amount` is null. Currency is uppercased ISO 4217; non-conforming
 * values fall through to a bare numeric.
 *
 * Frequencies of "one-time" / "other" produce no suffix; all others add the compact
 * `/wk` / `/mo` etc. tag from `formatFrequencySuffix`.
 */
export function formatFundingAmount(
  amount: bigint | string | null,
  currency: string | null,
  frequency: string | null,
): string | null {
  if (amount == null) return null;
  const units =
    typeof amount === "bigint"
      ? amount
      : typeof amount === "string"
        ? BigInt(amount)
        : null;
  if (units == null) return null;
  if (units === 0n) return "Any amount";
  const whole = Number(units) / 100;
  let formatted: string;
  try {
    if (currency && /^[A-Z]{3}$/.test(currency)) {
      formatted = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: whole < 1 ? 2 : 0,
      }).format(whole);
    } else {
      formatted = `${whole.toFixed(whole < 1 ? 2 : 0)}`;
    }
  } catch {
    formatted = `${whole.toFixed(whole < 1 ? 2 : 0)}${currency ? ` ${currency}` : ""}`;
  }
  if (!frequency || frequency === "one-time") return formatted;
  return `${formatted}${formatFrequencySuffix(frequency)}`;
}
