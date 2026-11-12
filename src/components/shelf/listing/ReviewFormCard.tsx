import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createLink } from "@tanstack/react-router";

import { Avatar } from "../../../design-system/avatar";
import { Button } from "../../../design-system/button";
import { Form } from "../../../design-system/form";
import { StarRatingInput } from "../../../design-system/star-rating";
import { TextArea } from "../../../design-system/text-area";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";
import { user } from "../../../integrations/tanstack-query/api-user.functions";
import { getInitials } from "../../../lib/get-initials";
import { RATING_WORDS } from "./listing-helpers";

const ButtonLink = createLink(Button);

const styles = stylex.create({
  card: {
    padding: { default: 20, [breakpoints.md]: 28 },
    borderColor: uiColor.border1,
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
    minWidth: 0,
  },
  center: {
    paddingBlock: 48,
    textAlign: "center",
  },
  title: {
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.017em",
    marginBottom: 20,
    marginTop: 0,
  },
  titleCenter: {
    marginBottom: 8,
  },
  text: {
    color: uiColor.text1,
    lineHeight: 1.5,
    marginBottom: 24,
    marginTop: 0,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
    marginBottom: 22,
  },
  label: {
    alignItems: "baseline",
    color: uiColor.text2,
    columnGap: 6,
    display: "flex",
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  optional: {
    color: uiColor.text1,
    fontSize: 13,
    fontWeight: fontWeight.normal,
  },
  stars: {
    alignItems: "center",
    columnGap: 12,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 8,
  },
  starsInput: {
    color: uiColor.text2,
  },
  word: {
    color: uiColor.text1,
    fontSize: 15,
  },
  error: {
    color: "light-dark(#c4302b, #ff8a80)",
    fontSize: 14,
    marginBottom: 0,
    marginTop: -8,
  },
  foot: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    rowGap: 10,
    marginTop: 4,
  },
  posting: {
    alignItems: "center",
    color: uiColor.text1,
    columnGap: 8,
    display: "flex",
    flexBasis: { default: "100%", [breakpoints.sm]: "auto" },
    fontSize: 13,
    marginRight: "auto",
    minWidth: 0,
  },
  postingName: {
    overflow: "hidden",
    color: uiColor.text2,
    fontWeight: fontWeight.medium,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  avatar: {
    borderRadius: "50%",
    flexShrink: 0,
    height: 24,
    width: 24,
  },
  fine: {
    color: uiColor.text1,
    fontSize: 12,
    textAlign: { default: "left", [breakpoints.sm]: "right" },
    marginBottom: 0,
    marginTop: 16,
  },
  mono: {
    fontFamily: fontFamily.mono,
  },
});

/** A centred notice card (signed out, listing not on AT Protocol yet). */
export function ReviewNoticeCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.card, styles.center)}>
      <h2 {...stylex.props(styles.title, styles.titleCenter)}>{title}</h2>
      <p {...stylex.props(styles.text)}>{children}</p>
      {action}
    </div>
  );
}

/** Rating + text form shared by the write and edit review pages. */
export function ReviewFormCard({
  title,
  listingName,
  rating,
  onRatingChange,
  text,
  onTextChange,
  error,
  isPending,
  submitLabel,
  onSubmit,
  cancel,
}: {
  title: string;
  listingName: string;
  rating: number;
  onRatingChange: (value: number) => void;
  text: string;
  onTextChange: (value: string) => void;
  error: string | null;
  isPending: boolean;
  submitLabel: string;
  onSubmit: () => void;
  cancel: { to: "/products/$productId"; params: { productId: string } };
}) {
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: profile } = useQuery({
    ...user.getUserProfileQueryOptions,
    enabled: session?.user != null,
  });
  const handle = profile?.blueskyHandle?.trim().replace(/^@+/, "");
  const postingAs = handle
    ? `@${handle}`
    : session?.user?.name?.trim() || "your account";

  return (
    <Form
      style={styles.card}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2 {...stylex.props(styles.title)}>{title}</h2>

      <div {...stylex.props(styles.field)}>
        <span id="review-rating-label" {...stylex.props(styles.label)}>
          Rating
        </span>
        <div {...stylex.props(styles.stars)}>
          <StarRatingInput
            value={rating}
            onChange={onRatingChange}
            size={30}
            aria-label="Your star rating"
            style={styles.starsInput}
          />
          <span aria-live="polite" {...stylex.props(styles.word)}>
            {RATING_WORDS[rating] ?? ""}
          </span>
        </div>
      </div>

      <div {...stylex.props(styles.field)}>
        <label htmlFor="review-body" {...stylex.props(styles.label)}>
          Review <span {...stylex.props(styles.optional)}>optional</span>
        </label>
        <TextArea
          size="lg"
          id="review-body"
          aria-label="Review (optional)"
          value={text}
          onChange={onTextChange}
          rows={6}
          autosize={false}
          isResizable={false}
          placeholder={`What do you like about ${listingName}? What could be better?`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              onSubmit();
            }
          }}
        />
      </div>

      {error ? (
        <p role="alert" {...stylex.props(styles.error)}>
          {error}
        </p>
      ) : null}

      <div {...stylex.props(styles.foot)}>
        <span {...stylex.props(styles.posting)}>
          <Avatar
            alt=""
            fallback={getInitials(postingAs.replace(/^@/, ""))}
            src={session?.user?.image ?? undefined}
            style={styles.avatar}
          />
          Posting as
          <span {...stylex.props(styles.postingName)}>{postingAs}</span>
        </span>
        <ButtonLink {...cancel} variant="secondary" size="lg">
          Cancel
        </ButtonLink>
        <Button type="submit" size="lg" isPending={isPending}>
          {submitLabel}
        </Button>
      </div>
      <p {...stylex.props(styles.fine)}>
        Your review is a{" "}
        <span {...stylex.props(styles.mono)}>fyi.atstore.listing.review</span>{" "}
        record in your repo. You can edit or delete it any time.
      </p>
    </Form>
  );
}
