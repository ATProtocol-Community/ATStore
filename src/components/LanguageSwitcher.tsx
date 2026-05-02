/**
 * Language switcher styled with the design-system `Select` so it matches the
 * other navbar controls. Persistence + i18next sync live in `useLocale`
 * (see `src/lib/LocaleContext.tsx`) — this component is a thin consumer,
 * mirroring how `ThemeMenu` consumes `useTheme`.
 */
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { isLocale, LOCALES } from "../lib/locale";
import { useLocale } from "../lib/LocaleContext";
import { Select, SelectItem } from "../design-system/select";

export function LanguageSwitcher() {
  const { t } = useTranslation("common");
  const { locale, setLocale } = useLocale();

  const items = LOCALES.map((id) => ({
    id,
    label: t(`languageSwitcher.languageName.${id}` as const),
  }));

  return (
    <Select
      aria-label={t("languageSwitcher.ariaLabel")}
      items={items}
      value={locale}
      variant="secondary"
      prefix={<Languages size={16} />}
      onChange={(key) => {
        if (typeof key === "string" && isLocale(key)) setLocale(key);
      }}
    >
      {(item) => <SelectItem>{item.label}</SelectItem>}
    </Select>
  );
}
