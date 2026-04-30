"use client";

import type { ComponentProps } from "react";
import type { Components } from "react-markdown";

import type { StyleXStyles } from "@stylexjs/stylex";
import * as stylex from "@stylexjs/stylex";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, {
  defaultSchema as rehypeSanitizeDefaultSchema,
  type Options as RehypeSanitizeOptions,
} from "rehype-sanitize";

import type { StyleXComponentProps } from "#/design-system/theme/types";
import { verticalSpace } from "#/design-system/theme/semantic-spacing.stylex";
import {
  Body,
  type BodyProps,
  ListItem,
  OrderedList,
  SmallBody,
  UnorderedList,
} from "#/design-system/typography";
import { Text } from "#/design-system/typography/text";

const styles = stylex.create({
  italic: {
    fontStyle: "italic",
  },
  restrictedRoot: {
    display: "flex",
    flexDirection: "column",
    gap: verticalSpace["6xl"],
    minWidth: 0,
  },
  restrictedParagraph: {
    marginBottom: 0,
    marginTop: 0,
  },
});

/**
 * Props for {@link RestrictedMarkdownContent}.
 */
export interface RestrictedMarkdownContentProps extends StyleXComponentProps<
  React.ComponentProps<"div">
> {
  /** Markdown allowing only emphasis and lists (CommonMark; no tables, strikethrough, etc.). */
  content: string;
  /** Optional typography styles merged into rendered paragraphs (e.g. listing body scale). */
  paragraphStyle?: BodyProps["style"];
  /** When true, paragraph nodes use {@link SmallBody} instead of {@link Body}. */
  compact?: boolean;
  /** Passed to rendered paragraph typography (ignored when semantics differ). */
  paragraphVariant?: BodyProps["variant"];
}

/**
 * Narrow tag allowlist layered on GitHub-ish defaults (`rehype-sanitize`): only bold,
 * italic, paragraphs, breaks, and lists survive the tree pass; everything else unwraps or strips.
 */
export const RESTRICTED_MARKDOWN_SANITIZE_SCHEMA: RehypeSanitizeOptions = {
  ...rehypeSanitizeDefaultSchema,
  tagNames: ["p", "strong", "em", "ul", "ol", "li", "br"],
};

const restrictedMarkdownBasics = {
  ul: ({
    className: _className,
    style: _style,
    ...props
  }: ComponentProps<"ul">) => <UnorderedList {...props} />,
  ol: ({
    className: _className,
    style: _style,
    ...props
  }: ComponentProps<"ol">) => <OrderedList {...props} />,
  li: ({
    className: _className,
    style: _style,
    ...props
  }: ComponentProps<"li">) => <ListItem {...props} />,
  br: ({
    className: _className,
    style: _style,
    ...props
  }: ComponentProps<"br">) => <br {...props} />,
  strong: ({ children }) => <Text weight="semibold">{children}</Text>,
  em: ({ children }) => <em {...stylex.props(styles.italic)}>{children}</em>,
} satisfies Omit<Components, "p">;

/**
 * Renders a narrow CommonMark subset (**bold**, *italic*, lists) with sanitization.
 */
export function RestrictedMarkdownContent({
  content,
  style,
  paragraphStyle,
  compact = false,
  paragraphVariant,
  ...props
}: RestrictedMarkdownContentProps) {
  const restrictedMarkdownComponents: Components = {
    ...restrictedMarkdownBasics,
    p: ({ className: _className, style: rmStyle, ...rest }) => {
      const mergedStyle = [styles.restrictedParagraph, paragraphStyle, rmStyle];
      const paragraphSx = mergedStyle as unknown as StyleXStyles;
      if (compact) {
        return (
          <SmallBody {...rest} variant={paragraphVariant} style={paragraphSx} />
        );
      }
      return <Body {...rest} variant={paragraphVariant} style={paragraphSx} />;
    },
  };

  return (
    <div {...stylex.props(styles.restrictedRoot, style)} {...props}>
      <ReactMarkdown
        remarkPlugins={[]}
        rehypePlugins={[[rehypeSanitize, RESTRICTED_MARKDOWN_SANITIZE_SCHEMA]]}
        components={restrictedMarkdownComponents}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
