"use client";

import type { StyleXStyles } from "@stylexjs/stylex";
import type { StyleXComponentProps } from "#/design-system/theme/types";
import type { BodyProps } from "#/design-system/typography";
import type { ComponentProps } from "react";
import type { Components } from "react-markdown";
import type { Options as RehypeSanitizeOptions } from "rehype-sanitize";

import * as stylex from "@stylexjs/stylex";
import { primaryColor } from "#/design-system/theme/color.stylex";
import { verticalSpace } from "#/design-system/theme/semantic-spacing.stylex";
import {
  Body,
  ListItem,
  OrderedList,
  SmallBody,
  UnorderedList,
} from "#/design-system/typography";
import { Text } from "#/design-system/typography/text";
import ReactMarkdown from "react-markdown";
import rehypeSanitize, {
  defaultSchema as rehypeSanitizeDefaultSchema,
} from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const styles = stylex.create({
  italic: {
    fontStyle: "italic",
  },
  link: {
    color: {
      default: primaryColor.text2,
      ":hover": primaryColor.text1,
    },
    cursor: "pointer",
    overflowWrap: "anywhere",
    textDecorationColor: "currentColor",
    textDecorationLine: "underline",
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
  },
  restrictedRoot: {
    gap: verticalSpace["6xl"],
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  restrictedParagraph: {
    marginBottom: 0,
    marginTop: 0,
  },
});

/** Hosts treated as external (open in new tab with safe rel); everything else assumed in-app. */
function isExternalHref(href: string | undefined): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href) || /^mailto:/i.test(href);
}

/**
 * Props for {@link RestrictedMarkdownContent}.
 */
export interface RestrictedMarkdownContentProps extends StyleXComponentProps<
  React.ComponentProps<"div">
> {
  /** Markdown allowing emphasis, lists, and links (CommonMark + GFM autolink literals). */
  content: string;
  /** Optional typography styles merged into rendered paragraphs (e.g. listing body scale). */
  paragraphStyle?: BodyProps["style"];
  /** When true, paragraph nodes use {@link SmallBody} instead of {@link Body}. */
  compact?: boolean;
  /** Passed to rendered paragraph typography (ignored when semantics differ). */
  paragraphVariant?: BodyProps["variant"];
}

/**
 * Narrow tag allowlist layered on GitHub-ish defaults (`rehype-sanitize`): only bold, italic,
 * paragraphs, breaks, lists, and anchors survive the tree pass; everything else unwraps or strips.
 *
 * `a` href/protocols inherit the default schema (http, https, mailto, …), so `javascript:` and
 * other unsafe URLs are still dropped before anything reaches the DOM.
 */
const RESTRICTED_MARKDOWN_SANITIZE_SCHEMA: RehypeSanitizeOptions = {
  ...rehypeSanitizeDefaultSchema,
  tagNames: ["p", "strong", "em", "ul", "ol", "li", "br", "a"],
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
  a: ({
    className: _className,
    style: _style,
    href,
    target,
    rel,
    ...props
  }: ComponentProps<"a">) => {
    const external = isExternalHref(href);
    return (
      // oxlint-disable-next-line jsx_a11y/anchor-has-content
      <a
        {...props}
        href={href}
        target={target ?? (external ? "_blank" : undefined)}
        rel={rel ?? (external ? "noopener noreferrer" : undefined)}
        {...stylex.props(styles.link)}
      />
    );
  },
} satisfies Omit<Components, "p">;

/**
 * Renders a narrow CommonMark subset (**bold**, *italic*, lists, links) with sanitization.
 *
 * Bare URLs (e.g. `https://example.com`) are autolinked via GFM's autolink-literal extension;
 * other GFM features (tables, strikethrough, task lists) are parsed but stripped by the schema.
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
        remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
        rehypePlugins={[[rehypeSanitize, RESTRICTED_MARKDOWN_SANITIZE_SCHEMA]]}
        components={restrictedMarkdownComponents}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
