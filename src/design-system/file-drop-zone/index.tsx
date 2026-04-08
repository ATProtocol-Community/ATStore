"use client";

import type {
  FileTriggerProps as AriaFileTriggerProps,
  ButtonProps,
  DropItem,
  DropZoneProps,
} from "react-aria-components";

import * as stylex from "@stylexjs/stylex";
import {
  FileTrigger as AriaFileTrigger,
  Button,
  DropZone,
} from "react-aria-components";

import type { StyleXComponentProps } from "../theme/types";

import {
  animationDuration,
  animationTimingFunction,
} from "../theme/animations.stylex";
import { primaryColor, uiColor } from "../theme/color.stylex";
import { mediaQueries } from "../theme/media-queries.stylex";
import { radius } from "../theme/radius.stylex";
import { ui } from "../theme/semantic-color.stylex";
import {
  horizontalSpace,
  verticalSpace,
} from "../theme/semantic-spacing.stylex";

async function getFiles(items: Array<DropItem>): Promise<Array<File>> {
  return Promise.all(
    items.filter((item) => item.kind === "file").map((item) => item.getFile()),
  );
}

const styles = stylex.create({
  dropZone: {
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    borderColor: {
      default: uiColor.border3,
      ":is([data-drop-target])": primaryColor.solid1,
    },
    paddingRight: horizontalSpace["2xl"],
    borderRadius: radius.lg,
    paddingTop: verticalSpace["2xl"],
    borderStyle: {
      default: "dashed",
      ":is([data-drop-target])": "solid",
    },
    borderWidth: 2,

    cornerShape: "squircle",
    overflow: "hidden",
    backgroundColor: {
      default: uiColor.bgSubtle,
      ":is([data-drop-target])": primaryColor.component1,
    },
    boxSizing: "border-box",
    position: "relative",
    transitionDuration: {
      default: animationDuration.fast,
      [mediaQueries.reducedMotion]: "0s",
    },
    transitionProperty: {
      default: "background-color, border-color",
      [mediaQueries.reducedMotion]: "none",
    },
    transitionTimingFunction: animationTimingFunction.easeInOut,

    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  defaultTrigger: {
    inset: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    opacity: {
      default: 0,
      ":is([data-hovered])": 0.5,
    },
    position: "absolute",
    transitionDuration: animationDuration.default,
    transitionProperty: "opacity",
    transitionTimingFunction: animationTimingFunction.easeInOut,
  },
});

interface FileDropZoneProps
  extends
    Omit<AriaFileTriggerProps, "className" | "style">,
    Pick<DropZoneProps, "isDisabled"> {
  style?: stylex.StyleXStyles | Array<stylex.StyleXStyles>;
  onAddFiles?: (files: Array<File>) => void;
}

export const FileDropZone = ({
  children,
  style,
  onAddFiles,
  isDisabled,
  acceptedFileTypes,
  ...props
}: FileDropZoneProps) => {
  return (
    <DropZone
      {...stylex.props(styles.dropZone, style)}
      isDisabled={isDisabled}
      onDrop={(e) => {
        void getFiles(e.items).then((files) => {
          onAddFiles?.(files);
        });
      }}
      getDropOperation={(types) => {
        if (!acceptedFileTypes) return "copy";
        return acceptedFileTypes.some((type) => types.has(type))
          ? "copy"
          : "cancel";
      }}
    >
      {({ isDropTarget }) => {
        if (isDropTarget) {
          return "Drop to upload";
        }

        return (
          <AriaFileTrigger
            {...props}
            acceptedFileTypes={acceptedFileTypes}
            onSelect={(files) => {
              // eslint-disable-next-line unicorn/prefer-spread
              onAddFiles?.(Array.from(files ?? []));
            }}
          >
            {children}
          </AriaFileTrigger>
        );
      }}
    </DropZone>
  );
};

interface FileDropDefaultTriggerProps extends StyleXComponentProps<ButtonProps> {}

export const FileDropDefaultTrigger = ({
  children,
  style,
  ...props
}: FileDropDefaultTriggerProps) => {
  return (
    <Button
      {...stylex.props(styles.defaultTrigger, ui.bgGhost, style)}
      {...props}
    >
      {children}
    </Button>
  );
};
