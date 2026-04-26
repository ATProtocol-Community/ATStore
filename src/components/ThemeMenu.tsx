import * as stylex from "@stylexjs/stylex";
import { Monitor, Moon, Sun } from "lucide-react";

import { Menu, MenuItem, SubMenu } from "../design-system/menu";
import { uiColor } from "../design-system/theme/color.stylex";
import { useTheme } from "../lib/ThemeContext";
import { isThemeMode, type ThemeMode } from "../lib/theme";

const styles = stylex.create({
  currentMode: {
    color: uiColor.text1,
  },
});

const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
}> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

function ThemeMenuItems({ onSelect }: { onSelect: (next: ThemeMode) => void }) {
  return THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
    <MenuItem
      key={id}
      id={id}
      prefix={<Icon size={16} />}
      // We call `onSelect` ourselves rather than relying on
      // `onSelectionChange` so picking the already-selected option is still a
      // no-op clearly handled at the call site.
      onAction={() => {
        if (isThemeMode(id)) onSelect(id);
      }}
    >
      {label}
    </MenuItem>
  ));
}

/**
 * Theme picker rendered as a submenu inside a parent menu (e.g. the avatar
 * menu). The trigger is a `MenuItem` so it integrates cleanly with the
 * surrounding menu.
 */
export function ThemeSubMenu() {
  const { mode, setMode } = useTheme();
  const currentLabel =
    THEME_OPTIONS.find((option) => option.id === mode)?.label ?? "System";

  return (
    <SubMenu
      trigger={
        <MenuItem
          suffix={
            <span {...stylex.props(styles.currentMode)}>{currentLabel}</span>
          }
        >
          Theme
        </MenuItem>
      }
      selectionMode="single"
      selectedKeys={new Set([mode])}
      disallowEmptySelection
    >
      <ThemeMenuItems onSelect={setMode} />
    </SubMenu>
  );
}

/**
 * Standalone theme picker — a top-level menu with its own trigger. Used in
 * spots where there's no parent account menu (e.g. when signed out).
 */
export function ThemeMenu({ trigger }: { trigger: React.ReactNode }) {
  const { mode, setMode } = useTheme();

  return (
    <Menu
      trigger={trigger}
      placement="bottom end"
      selectionMode="single"
      selectedKeys={new Set([mode])}
      disallowEmptySelection
    >
      <ThemeMenuItems onSelect={setMode} />
    </Menu>
  );
}
