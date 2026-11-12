import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";

import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";

const styles = stylex.create({
  footer: {
    alignItems: "center",
    backdropFilter: "blur(12px)",
    backgroundColor: `color-mix(in srgb, ${uiColor.bgSubtle} 86%, transparent)`,
    columnGap: 10,
    display: "flex",
    flexWrap: { default: "wrap", [breakpoints.md]: "nowrap" },
    justifyContent: "flex-end",
    position: "sticky",
    rowGap: 10,
    zIndex: 5,
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    bottom: 0,
    marginTop: 24,
    paddingBottom: 20,
    paddingTop: 16,
  },
  note: {
    color: uiColor.text1,
    flexBasis: { default: "100%", [breakpoints.md]: "auto" },
    flexGrow: 1,
    fontSize: 13,
    lineHeight: 1.4,
    minWidth: 0,
  },
});

/**
 * Sticky action bar at the bottom of a Shelf form: an optional muted note on
 * the left, then the actions (Cancel, primary). Frosted paper with a hairline
 * on top so fields scroll underneath it.
 */
export function FormFooter({
  note,
  children,
}: {
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.footer)}>
      {note ? <div {...stylex.props(styles.note)}>{note}</div> : null}
      {children}
    </div>
  );
}
