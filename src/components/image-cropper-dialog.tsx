"use client";

import type { ImageCropperRootProps } from "#/design-system/image-cropper";

import * as stylex from "@stylexjs/stylex";
import { Button } from "#/design-system/button";
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "#/design-system/dialog";
import { Flex } from "#/design-system/flex";
import { ImageCropper } from "#/design-system/image-cropper";
import { Slider } from "#/design-system/slider";
import {
  gap as gapSpace,
  horizontalSpace,
  verticalSpace,
} from "#/design-system/theme/semantic-spacing.stylex";
import { ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useState } from "react";

const hiddenTriggerStyles = stylex.create({
  trigger: {
    margin: -1,
    padding: 0,
    borderStyle: "none",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    position: "fixed",
    height: 1,
    width: 1,
  },
});

const styles = stylex.create({
  body: {
    gap: gapSpace["2xl"],
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    marginTop: 0,
    minHeight: 0,
  },
  content: {
    height: "100%",
  },
  cropper: {
    flexGrow: 1,
    minHeight: 0,
  },
  description: {
    marginBottom: verticalSpace["3xl"],
    marginTop: verticalSpace["3xl"],
  },
  dialog: {
    height: "min(520px, 80vh)",
  },
  slider: {
    flexGrow: 1,
  },
  sliderWrapper: {
    boxSizing: "border-box",
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    width: "100%",
  },
});

/** Inert trigger so `Dialog` can be controlled only via `isOpen` / `onOpenChange`. */
function HiddenDialogTrigger() {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      {...stylex.props(hiddenTriggerStyles.trigger)}
    />
  );
}

export interface ImageCropperDialogProps extends Pick<
  ImageCropperRootProps,
  "aspectRatio"
> {
  image: Blob;
  onSubmit: (image: Blob) => void;
  children?: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title?: string;
  description?: string;
}

/**
 * Modal image cropper (same pattern as Kitchen): zoom slider + save/cancel.
 */
export function ImageCropperDialog({
  image,
  aspectRatio = 1,
  onSubmit,
  children,
  isOpen,
  onOpenChange,
  title = "Crop image",
  description = "Choose the area of the image you want to use.",
}: ImageCropperDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [croppedImage, setCroppedImage] = useState<Blob | null>(null);

  return (
    <Dialog
      trigger={children ?? <HiddenDialogTrigger />}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      style={styles.dialog}
    >
      <Flex direction="column" style={styles.content}>
        <DialogHeader>{title}</DialogHeader>
        <DialogDescription style={styles.description}>
          {description}
        </DialogDescription>
        <DialogBody style={styles.body}>
          <ImageCropper.Root
            image={image}
            aspectRatio={aspectRatio}
            style={styles.cropper}
            zoom={zoom}
            onZoomChange={setZoom}
            onCropChange={setCroppedImage}
            minZoom={0.2}
            maxZoom={5}
          >
            <ImageCropper.Description />
            <ImageCropper.Image />
            <ImageCropper.CropArea />
          </ImageCropper.Root>
          <Flex align="center" gap="2xl" style={styles.sliderWrapper}>
            <ZoomOutIcon size={18} />
            <Slider
              minValue={0.2}
              maxValue={5}
              step={0.01}
              value={zoom}
              onChange={setZoom}
              showValueLabel={false}
              style={styles.slider}
            />
            <ZoomInIcon size={18} />
          </Flex>
        </DialogBody>
        <DialogFooter>
          <Button slot="close" variant="secondary">
            Cancel
          </Button>
          <Button
            slot="close"
            onPress={() => {
              if (croppedImage) {
                onSubmit(croppedImage);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </Flex>
    </Dialog>
  );
}
