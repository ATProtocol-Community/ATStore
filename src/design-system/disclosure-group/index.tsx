"use client";

import type { DisclosureGroupProps as AriaDisclosureGroupProps } from "react-aria-components";

import * as stylex from "@stylexjs/stylex";
import { use } from "react";
import { DisclosureGroup as AriaDisclosureGroup } from "react-aria-components";

import type { Size, StyleXComponentProps } from "../theme/types";

import { SizeContext } from "../context";
import { uiColor } from "../theme/color.stylex";

const styles = stylex.create({
  group: {
    display: "flex",
    flexDirection: "column",
  },
  separator: {
    borderWidth: 0,
    backgroundColor: uiColor.border2,
    height: "1px",
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    width: "100%",
  },
});

export interface DisclosureGroupProps extends StyleXComponentProps<AriaDisclosureGroupProps> {
  size?: Size;
}

export function DisclosureGroup({
  style,
  size: sizeProp,
  ...props
}: DisclosureGroupProps) {
  const size = sizeProp || use(SizeContext);

  return (
    <SizeContext value={size}>
      <AriaDisclosureGroup
        {...props}
        data-size={size}
        {...stylex.props(styles.group, style)}
      />
    </SizeContext>
  );
}

export interface SeparatorProps extends StyleXComponentProps<
  React.HTMLAttributes<HTMLDivElement>
> {}

export function DisclosureGroupSeparator({ style, ...props }: SeparatorProps) {
  return <div {...props} {...stylex.props(styles.separator, style)} />;
}
