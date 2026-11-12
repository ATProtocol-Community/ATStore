import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { Check } from "lucide-react";
import { ToggleButton } from "react-aria-components";

import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { fontWeight } from "../../../design-system/theme/typography.stylex";

const styles = stylex.create({
  pill: {
    borderColor: {
      default: uiColor.border2,
      ":is([data-selected])": uiColor.text2,
    },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: 12,
    alignItems: "center",
    backgroundColor: {
      default: uiColor.bg,
      ":is([data-hovered])": uiColor.component1,
      ":is([data-selected])": uiColor.text2,
    },
    boxSizing: "border-box",
    color: {
      default: uiColor.text2,
      ":is([data-selected])": uiColor.bg,
    },
    columnGap: 6,
    cursor: { default: "pointer", ":is([data-disabled])": "not-allowed" },
    display: "inline-flex",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: {
      default: fontWeight.normal,
      ":is([data-selected])": fontWeight.medium,
    },
    opacity: { default: 1, ":is([data-disabled])": 0.45 },
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":is([data-focus-visible])": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.fast,
    transitionProperty: "background-color, border-color, color",
    whiteSpace: "nowrap",
    height: 32,
  },
});

/** Toggleable tag pill for tag pickers: outline when off, solid ink with a check when on. */
export function TagPill({
  children,
  isSelected,
  isDisabled,
  onChange,
}: {
  children: ReactNode;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  return (
    <ToggleButton
      isSelected={isSelected}
      isDisabled={isDisabled}
      onChange={onChange}
      {...stylex.props(styles.pill)}
    >
      {isSelected ? <Check size={12} strokeWidth={2.6} aria-hidden /> : null}
      {children}
    </ToggleButton>
  );
}
