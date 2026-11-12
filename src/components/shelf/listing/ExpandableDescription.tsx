import * as stylex from "@stylexjs/stylex";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { fontWeight } from "../../../design-system/theme/typography.stylex";
import { RestrictedMarkdownContent } from "../../restricted-markdown-content";

/** Descriptions longer than this fold behind "Read more". */
const FOLD_AFTER_CHARACTERS = 600;

const styles = stylex.create({
  paragraph: {
    color: uiColor.text2,
    fontSize: { default: 16, [breakpoints.md]: 18 },
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
  },
  folded: {
    overflow: "hidden",
    maskImage: "linear-gradient(180deg, #000 60%, transparent)",
    maxHeight: "15em",
  },
  readMore: {
    padding: 0,
    borderRadius: 6,
    borderWidth: 0,
    paddingBlock: 6,
    alignItems: "center",
    backgroundColor: "transparent",
    color: uiColor.text2,
    columnGap: 4,
    cursor: "pointer",
    display: "inline-flex",
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    outlineColor: uiColor.text2,
    outlineOffset: 3,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    marginTop: 4,
  },
});

/** Listing description in reading size; long ones fold behind "Read more". */
export function ExpandableDescription({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const foldable = content.length > FOLD_AFTER_CHARACTERS;
  const folded = foldable && !expanded;

  return (
    <div>
      <RestrictedMarkdownContent
        content={content}
        paragraphStyle={styles.paragraph}
        style={folded ? styles.folded : undefined}
      />
      {folded ? (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          {...stylex.props(styles.readMore)}
        >
          Read more
          <ChevronDown size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
