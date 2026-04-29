"use client";

import type { Components } from "react-markdown";

import * as stylex from "@stylexjs/stylex";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import type { LinkProps } from "#/design-system/link";
import type { StyleXComponentProps } from "#/design-system/theme/types";

import { Link } from "#/design-system/link";
import { verticalSpace } from "#/design-system/theme/semantic-spacing.stylex";
import {
  Blockquote,
  Body,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  InlineCode,
  ListItem,
  OrderedList,
  Pre,
  UnorderedList,
} from "#/design-system/typography";
import { Text } from "#/design-system/typography/text";

const styles = stylex.create({
  root: {},
  italic: {
    fontStyle: "italic",
  },
  standardMargin: {
    marginBottom: verticalSpace["4xl"],
    marginTop: verticalSpace["4xl"],
  },
  h2: {
    marginBottom: verticalSpace["3xl"],
    marginTop: verticalSpace["7xl"],
  },
  h3: {
    marginBottom: verticalSpace["4xl"],
    marginTop: verticalSpace["7xl"],
  },
  h4: {
    marginBottom: verticalSpace["7xl"],
    marginTop: verticalSpace["7xl"],
  },
  h5: {
    marginBottom: verticalSpace["7xl"],
    marginTop: verticalSpace["7xl"],
  },
});

/** Map of react-markdown element types to Hip typography; not a React component. */
// oxlint-disable-next-line react-refresh/only-export-components
export const markdownComponents: Components = {
  h1: ({ className: _className, style: _style, ...props }) => (
    <Heading1 {...props} />
  ),
  h2: ({ className: _className, style: _style, ...props }) => (
    <Heading2 style={styles.h2} {...props} />
  ),
  h3: ({ className: _className, style: _style, ...props }) => (
    <Heading3 style={styles.h3} {...props} />
  ),
  h4: ({ className: _className, style: _style, ...props }) => (
    <Heading4 style={styles.h4} {...props} />
  ),
  h5: ({ className: _className, style: _style, ...props }) => (
    <Heading5 style={styles.h5} {...props} />
  ),
  p: ({ className: _className, style: _style, ...props }) => (
    <Body style={styles.standardMargin} {...props} />
  ),
  a: ({ className: _className, style: _style, ...props }) => (
    <Link {...(props as LinkProps)} />
  ),
  ul: ({ className: _className, style: _style, ...props }) => (
    <UnorderedList {...props} />
  ),
  ol: ({ className: _className, style: _style, ...props }) => (
    <OrderedList {...props} />
  ),
  li: ({ className: _className, style: _style, ...props }) => (
    <ListItem {...props} />
  ),
  pre: ({ className: _className, style: _style, ...props }) => (
    <Pre {...props} />
  ),
  code: ({ className: _className, style: _style, ...props }) => (
    <InlineCode {...props} />
  ),
  blockquote: ({ className: _className, style: _style, ...props }) => (
    <Blockquote {...props} />
  ),
  strong: ({ children }) => <Text weight="semibold">{children}</Text>,
  em: ({ children }) => <em {...stylex.props(styles.italic)}>{children}</em>,
};

/**
 * Props for the MarkdownContent component.
 */
export interface MarkdownContentProps extends StyleXComponentProps<
  React.ComponentProps<"div">
> {
  /**
   * The markdown string to render.
   */
  content: string;
}

/**
 * Renders GitHub-flavored markdown with sanitization to prevent XSS.
 */
export function MarkdownContent({
  content,
  style,
  ...props
}: MarkdownContentProps) {
  return (
    <div {...stylex.props(styles.root, style)} {...props}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
