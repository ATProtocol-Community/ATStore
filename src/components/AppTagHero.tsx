import * as stylex from "@stylexjs/stylex";

import { Flex } from "../design-system/flex";
import { ui } from "../design-system/theme/semantic-color.stylex";
import {
  gap,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";

interface AppTagHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  imageSrc?: string | null;
}

const styles = stylex.create({
  root: {
    width: "100%",
  },
  imageFrame: {
    borderRadius: radius["2xl"],
    maxHeight: "240px",
    overflow: "hidden",
    width: "100%",
  },
  image: {
    display: "block",
    height: "240px",
    objectFit: "cover",
    objectPosition: "center",
    width: "100%",
  },
  imageFallback: {
    background:
      "linear-gradient(135deg, rgba(87, 112, 255, 0.18) 0%, rgba(229, 76, 180, 0.16) 50%, rgba(70, 195, 161, 0.16) 100%)",
    height: "240px",
    width: "100%",
  },
  copy: {
    maxWidth: "56rem",
    paddingTop: verticalSpace["2xl"],
  },
  eyebrow: {
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
});

export function AppTagHero({
  eyebrow,
  title,
  description,
  imageSrc,
}: AppTagHeroProps) {
  return (
    <Flex direction="column" gap="4xl" style={styles.root}>
      <div {...stylex.props(styles.imageFrame, ui.bgSubtle)}>
        {imageSrc ? (
          <img {...stylex.props(styles.image)} alt="" src={imageSrc} />
        ) : (
          <div {...stylex.props(styles.imageFallback)} aria-hidden="true" />
        )}
      </div>

      <Flex direction="column" gap="5xl" style={styles.copy}>
        {eyebrow ? (
          <SmallBody style={styles.eyebrow}>{eyebrow}</SmallBody>
        ) : null}
        <Text size={{ default: "4xl", sm: "6xl" }} weight="semibold">
          {title}
        </Text>
        {description ? <Body variant="secondary">{description}</Body> : null}
      </Flex>
    </Flex>
  );
}
