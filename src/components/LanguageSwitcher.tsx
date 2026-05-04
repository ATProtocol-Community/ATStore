/**
 * Language switcher. Persistence + i18next sync live in `useLocale`
 * (see `src/lib/LocaleContext.tsx`) — these components are thin consumers,
 * mirroring how `ThemeMenu` consumes `useTheme`.
 *
 * Two presentations:
 *   - **`<LanguageSwitcher />`** — standalone navbar control for signed-out
 *     users. Renders a Select on desktop and an icon-only Menu on mobile.
 *     Hides itself when the user is signed in (the `<LanguageSubMenu />` in
 *     the avatar dropdown takes over).
 *   - **`<LanguageSubMenu />`** — submenu rendered inside the avatar dropdown
 *     when the user is signed in, alongside `<ThemeSubMenu />`. On mobile it
 *     calls `onOpenDrawer` instead of nesting — the caller renders
 *     `<LanguageDrawer>` outside the Menu so it survives the Menu closing.
 *   - **`<LanguageDrawer />`** — full-bleed bottom drawer for mobile. Rendered
 *     by the caller (NavbarAuth) outside the Menu tree.
 */
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Locale } from "../lib/locale";

import { Drawer, DrawerBody, DrawerHeader } from "../design-system/drawer";
import { IconButton } from "../design-system/icon-button";
import { ListBox, ListBoxItem } from "../design-system/listbox";
import { Menu, MenuItem, SubMenu } from "../design-system/menu";
import { Select, SelectItem } from "../design-system/select";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  breakpoints,
  containerBreakpoints,
} from "../design-system/theme/media-queries.stylex";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { LOCALES, isLocale } from "../lib/locale";
import { useLocale } from "../lib/LocaleContext";
import { useIsMobile } from "../lib/useIsMobile";

/**
 * Feature flag — explicit opt-in in any environment, and only ever active in
 * dev builds until we've added at least 1 language other than en.
 *
 * Set `VITE_I18N_LANGUAGE_SWITCHER=true` in `.env` to enable.
 */
const SHOW_LANGUAGE_SWITCHER =
  import.meta.env.DEV && import.meta.env.VITE_I18N_LANGUAGE_SWITCHER === "true";

const styles = stylex.create({
  mobileOnly: {
    display: {
      default: "inline-flex",
      [containerBreakpoints.sm]: "none",
    },
  },
  desktopOnly: {
    display: {
      default: "none",
      [containerBreakpoints.sm]: "inline-flex",
    },
  },
  currentLanguage: {
    overflow: "hidden",
    color: uiColor.text1,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: {
      default: "0.8rem",
      [breakpoints.sm]: "none",
    },
  },
});

function useLanguageOptions() {
  const { t } = useTranslation("common");
  return LOCALES.map((id) => ({
    id,
    label: t(`languageSwitcher.languageName.${id}` as const),
  }));
}

/**
 * Standalone navbar switcher for guests. Returns null when the user is
 * signed in — `<LanguageSubMenu />` lives inside the avatar dropdown for
 * that case.
 */
export function LanguageSwitcher() {
  if (!SHOW_LANGUAGE_SWITCHER) return null;
  return <LanguageSwitcherGuest />;
}

function LanguageSwitcherGuest() {
  const { data: session } = useQuery(user.getSessionQueryOptions);
  if (session?.user) return null;
  return <LanguageSwitcherControl />;
}

function LanguageSwitcherControl() {
  const { t } = useTranslation("common");
  const { locale, setLocale } = useLocale();
  const languageOptions = useLanguageOptions();

  const onSelect = (next: string) => {
    if (isLocale(next)) setLocale(next);
  };

  return (
    <>
      <span {...stylex.props(styles.mobileOnly)}>
        <Menu
          trigger={
            <IconButton
              variant="tertiary"
              size="lg"
              aria-label={t("languageSwitcher.ariaLabel")}
            >
              <Languages />
            </IconButton>
          }
          placement="bottom end"
          selectionMode="single"
          selectedKeys={new Set<Locale>([locale])}
          disallowEmptySelection
        >
          {languageOptions.map(({ id, label }) => (
            <MenuItem key={id} id={id} onAction={() => onSelect(id)}>
              {label}
            </MenuItem>
          ))}
        </Menu>
      </span>

      <span {...stylex.props(styles.desktopOnly)}>
        <Select
          aria-label={t("languageSwitcher.ariaLabel")}
          items={languageOptions}
          value={locale}
          variant="secondary"
          size="lg"
          prefix={<Languages size={16} />}
          onChange={(key) => {
            if (typeof key === "string") onSelect(key);
          }}
        >
          {({ label }) => <SelectItem>{label}</SelectItem>}
        </Select>
      </span>
    </>
  );
}

/**
 * Language picker rendered as a submenu inside a parent menu (e.g. the
 * avatar menu). On mobile, calls `onOpenDrawer` instead of opening a
 * nested submenu — the caller must render `<LanguageDrawer>` outside the
 * Menu so it survives the Menu unmounting.
 */
export function LanguageSubMenu({
  onOpenDrawer,
}: {
  onOpenDrawer?: () => void;
}) {
  if (!SHOW_LANGUAGE_SWITCHER) return null;
  return <LanguageSubMenuControl onOpenDrawer={onOpenDrawer} />;
}

function LanguageSubMenuControl({
  onOpenDrawer,
}: {
  onOpenDrawer?: () => void;
}) {
  const { t } = useTranslation("common");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MenuItem prefix={<Languages size={16} />} onAction={onOpenDrawer}>
        {t("languageSwitcher.userMenuLabel")}
      </MenuItem>
    );
  }

  return <LanguageSubMenuDesktop />;
}

function LanguageSubMenuDesktop() {
  const { t } = useTranslation("common");
  const { locale, setLocale } = useLocale();
  const languageOptions = useLanguageOptions();
  const currentLabel =
    languageOptions.find((option) => option.id === locale)?.label ?? locale;

  const onSelect = (next: string) => {
    if (isLocale(next)) setLocale(next);
  };

  return (
    <SubMenu
      trigger={
        <MenuItem
          prefix={<Languages size={16} />}
          suffix={
            <span {...stylex.props(styles.currentLanguage)}>
              {currentLabel}
            </span>
          }
        >
          {t("languageSwitcher.userMenuLabel")}
        </MenuItem>
      }
      selectionMode="single"
      selectedKeys={new Set<Locale>([locale])}
      disallowEmptySelection
    >
      {languageOptions.map(({ id, label }) => (
        <MenuItem key={id} id={id} onAction={() => onSelect(id)}>
          {label}
        </MenuItem>
      ))}
    </SubMenu>
  );
}

/**
 * Full-bleed bottom drawer for language selection on mobile. Render this
 * outside the avatar Menu so it stays mounted after the Menu closes.
 */
export function LanguageDrawer({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!SHOW_LANGUAGE_SWITCHER) return null;
  return <LanguageDrawerControl isOpen={isOpen} onOpenChange={onOpenChange} />;
}

function LanguageDrawerControl({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("common");
  const { locale, setLocale } = useLocale();
  const languageOptions = useLanguageOptions();

  const onSelect = (next: string) => {
    if (isLocale(next)) {
      setLocale(next);
      onOpenChange(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      direction="bottom"
      trigger={null}
    >
      <DrawerHeader>{t("languageSwitcher.userMenuLabel")}</DrawerHeader>
      <DrawerBody>
        <ListBox
          aria-label={t("languageSwitcher.ariaLabel")}
          selectionMode="single"
          selectedKeys={new Set<Locale>([locale])}
          disallowEmptySelection
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (typeof next === "string") onSelect(next);
          }}
        >
          {languageOptions.map(({ id, label }) => (
            <ListBoxItem key={id} id={id}>
              {label}
            </ListBoxItem>
          ))}
        </ListBox>
      </DrawerBody>
    </Drawer>
  );
}
