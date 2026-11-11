import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";

import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";

const styles = stylex.create({
  eyebrow: {
    color: uiColor.text1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  formCard: {
    padding: { default: 20, [breakpoints.md]: 28 },
    borderColor: uiColor.border1,
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    minWidth: 0,
  },
  formCardTitle: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.017em",
    lineHeight: 1.2,
    marginBottom: 20,
    marginTop: 0,
  },
  code: {
    borderColor: "light-dark(transparent, #272522)",
    borderRadius: 14,
    borderStyle: "solid",
    borderWidth: 1,
    overflow: "auto",
    paddingBlock: 18,
    paddingInline: 20,
    backgroundColor: "light-dark(#171613, #0a0a09)",
    color: "#e9e5dc",
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 1.6,
    tabSize: 2,
    marginBottom: 16,
    marginTop: 0,
  },
  codeInner: {
    fontFamily: "inherit",
    fontSize: "inherit",
  },
  codeComment: {
    color: "#8d877b",
  },
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: "0.88em",
    overflowWrap: "anywhere",
  },
});

/** Small uppercase label above headings ("Instant match", "The big idea"). */
export function Eyebrow({
  children,
  style,
}: {
  children: ReactNode;
  style?: stylex.StyleXStyles;
}) {
  return <div {...stylex.props(styles.eyebrow, style)}>{children}</div>;
}

/** Near-white surface with a hairline border: the container for Shelf forms. */
export function FormCard({
  children,
  title,
  titleId,
  style,
}: {
  children: ReactNode;
  title?: ReactNode;
  titleId?: string;
  style?: stylex.StyleXStyles;
}) {
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      {...stylex.props(styles.formCard, style)}
    >
      {title ? (
        <h2 id={titleId} {...stylex.props(styles.formCardTitle)}>
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** Dark code block used for API samples (same in light and dark mode). */
export function CodeBlock({
  children,
  comment,
  label,
}: {
  children: ReactNode;
  /** Optional `# comment` line rendered dimmed above the code. */
  comment?: string;
  /** Accessible name for the scrollable region. */
  label?: string;
}) {
  return (
    // Scrollable regions must be keyboard focusable.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <pre tabIndex={0} aria-label={label} {...stylex.props(styles.code)}>
      <code {...stylex.props(styles.codeInner)}>
        {comment ? (
          <>
            <span {...stylex.props(styles.codeComment)}># {comment}</span>
            {"\n"}
          </>
        ) : null}
        {children}
      </code>
    </pre>
  );
}

/** Inline monospace for NSIDs, params and paths inside prose. */
export function Mono({ children }: { children: ReactNode }) {
  return <code {...stylex.props(styles.mono)}>{children}</code>;
}
