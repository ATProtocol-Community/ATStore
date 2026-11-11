import * as stylex from "@stylexjs/stylex";
import { Check, Clock, X } from "lucide-react";

import {
  criticalColor,
  successColor,
  uiColor,
  warningColor,
} from "../../../design-system/theme/color.stylex";
import { fontWeight } from "../../../design-system/theme/typography.stylex";

const styles = stylex.create({
  pill: {
    borderRadius: 999,
    paddingBlock: 4,
    paddingInline: 10,
    alignItems: "center",
    columnGap: 5,
    display: "inline-flex",
    flexShrink: 0,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
  live: {
    backgroundColor: successColor.component1,
    color: successColor.text1,
  },
  pending: {
    backgroundColor: warningColor.component1,
    color: warningColor.text2,
  },
  rejected: {
    backgroundColor: criticalColor.component1,
    color: criticalColor.text1,
  },
  other: {
    backgroundColor: uiColor.component2,
    color: uiColor.text2,
  },
});

/** Directory verification status as a small tinted pill. */
export function StatusPill({ status }: { status: string }) {
  switch (status) {
    case "verified": {
      return (
        <span {...stylex.props(styles.pill, styles.live)}>
          <Check size={13} strokeWidth={2.4} aria-hidden />
          Live
        </span>
      );
    }
    case "unverified": {
      return (
        <span {...stylex.props(styles.pill, styles.pending)}>
          <Clock size={13} strokeWidth={2.4} aria-hidden />
          Pending review
        </span>
      );
    }
    case "rejected": {
      return (
        <span {...stylex.props(styles.pill, styles.rejected)}>
          <X size={13} strokeWidth={2.4} aria-hidden />
          Rejected
        </span>
      );
    }
    default: {
      return <span {...stylex.props(styles.pill, styles.other)}>{status}</span>;
    }
  }
}
