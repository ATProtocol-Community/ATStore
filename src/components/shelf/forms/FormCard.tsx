import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import {
  criticalColor,
  uiColor,
} from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";

const styles = stylex.create({
  card: {
    padding: { default: 20, [breakpoints.md]: 28 },
    borderColor: uiColor.border1,
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    minWidth: 0,
  },
  title: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.017em",
    lineHeight: 1.2,
  },
  description: {
    color: uiColor.text1,
    fontSize: 13,
    lineHeight: 1.45,
    marginBottom: 0,
    marginTop: 6,
  },
  header: {
    marginBottom: 20,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    rowGap: 22,
  },
  label: {
    alignItems: "baseline",
    color: uiColor.text2,
    columnGap: 6,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    rowGap: 2,
  },
  required: {
    color: criticalColor.solid1,
  },
  hint: {
    color: uiColor.text1,
    fontSize: 13,
    fontWeight: fontWeight.normal,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
    minWidth: 0,
  },
  help: {
    margin: 0,
    color: uiColor.text1,
    fontSize: 13,
    lineHeight: 1.45,
  },
  critical: {
    color: criticalColor.text1,
  },
  labelRow: {
    alignItems: "center",
    columnGap: 12,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
});

/** A titled white card that groups related fields on a Shelf form. */
export function FormCard({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.header)}>
        <h2 id={titleId} {...stylex.props(styles.title)}>
          {title}
        </h2>
        {description ? (
          <p {...stylex.props(styles.description)}>{description}</p>
        ) : null}
      </div>
      <div {...stylex.props(styles.body)}>{children}</div>
    </section>
  );
}

/**
 * Label row for custom fields that aren't a DS input (images, tag pickers):
 * name, optional required star and a dim hint like "16:9".
 */
export function FieldLabel({
  id,
  children,
  isRequired = false,
  hint,
  action,
}: {
  id?: string;
  children: ReactNode;
  isRequired?: boolean;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  const label = (
    <span id={id} {...stylex.props(styles.label)}>
      {children}
      {isRequired ? (
        <span aria-hidden {...stylex.props(styles.required)}>
          *
        </span>
      ) : null}
      {hint ? <span {...stylex.props(styles.hint)}>{hint}</span> : null}
    </span>
  );
  if (!action) return label;
  return (
    <span {...stylex.props(styles.labelRow)}>
      {label}
      {action}
    </span>
  );
}

/** Vertical stack for one custom field: label, control, help. */
export function FormField({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.field)}>{children}</div>;
}

/** Small muted help line under a field. `tone="critical"` for warnings. */
export function FieldHelp({
  children,
  tone = "default",
  id,
}: {
  children: ReactNode;
  tone?: "default" | "critical";
  id?: string;
}) {
  return (
    <p
      id={id}
      {...stylex.props(styles.help, tone === "critical" && styles.critical)}
    >
      {children}
    </p>
  );
}
