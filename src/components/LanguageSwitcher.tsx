/**
 * Language switcher styled with the design-system `Select` so it matches the
 * other navbar controls. Persistence + i18next sync live in `useLocale`
 * (see `src/lib/LocaleContext.tsx`) — this component is a thin consumer,
 * mirroring how `ThemeMenu` consumes `useTheme`.
 */
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Select, SelectItem } from "../design-system/select";
import { LOCALES, isLocale } from "../lib/locale";
import { useLocale } from "../lib/LocaleContext";

/**
 * Feature flag — explicit opt-in in any environment, and only ever active in
 * dev builds until we've added at least 1 language other than en.
 *
 * Keeps the control out of the live site until at least one real
 * second locale ships, while letting contributors
 * test both the on and off states locally by toggling the env var.
 *
 * Set `VITE_I18N_LANGUAGE_SWITCHER=true` in `.env` to enable.
 */
const SHOW_LANGUAGE_SWITCHER =
  import.meta.env.DEV && import.meta.env.VITE_I18N_LANGUAGE_SWITCHER === "true";

export function LanguageSwitcher() {
  if (!SHOW_LANGUAGE_SWITCHER) return null;
  return <LanguageSwitcherControl />;
}

function LanguageSwitcherControl() {
  const { t } = useTranslation("common");
  const { locale, setLocale } = useLocale();

  const languageOptions = LOCALES.map((id) => ({
    id,
    label: t(`languageSwitcher.languageName.${id}` as const),
  }));

  return (
    <Select
      aria-label={t("languageSwitcher.ariaLabel")}
      items={languageOptions}
      value={locale}
      variant="secondary"
      prefix={<Languages size={16} />}
      onChange={(key) => {
        if (typeof key === "string" && isLocale(key)) setLocale(key);
      }}
    >
      {({ label }) => <SelectItem>{label}</SelectItem>}
    </Select>
  );
}
