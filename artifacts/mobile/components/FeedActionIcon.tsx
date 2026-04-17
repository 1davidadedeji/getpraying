import React, { useId } from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import colors from "@/constants/colors";

export type FeedActionKind = "pray" | "comment" | "save" | "share";

const INACTIVE = "#B4BACD";
const SIZE = 24;

interface FeedActionIconProps {
  kind: FeedActionKind;
  active: boolean;
  size?: number;
  /** Pray icon on an orange / filled button: use a light “on-brand” fill when active. */
  prayActiveOnWarmBackground?: boolean;
  /** Save (ladder) on a primary-filled circle: use light strokes when active. */
  saveActiveOnPrimaryBackground?: boolean;
}

/**
 * Stylized feed action glyphs (prayer / comment / save / share).
 * Inactive: soft gray; active: warm brand colors (matches “gray vs colored” states).
 */
export default function FeedActionIcon({
  kind,
  active,
  size = SIZE,
  prayActiveOnWarmBackground,
  saveActiveOnPrimaryBackground,
}: FeedActionIconProps) {
  const shareGradId = useId().replace(/:/g, "");
  const s = size;
  const stroke = active ? undefined : INACTIVE;
  const fillPray =
    active && prayActiveOnWarmBackground ? colors.surface : active ? colors.flame : INACTIVE;
  const fillComment = active ? colors.primary : INACTIVE;
  const fillSave =
    active && saveActiveOnPrimaryBackground ? colors.surface : active ? "#C4A574" : INACTIVE;
  const fillShareEnd = active ? "#F59E0B" : INACTIVE;

  if (kind === "pray") {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M8.2 18.2c-.8-.4-1.4-1.1-1.7-2L5.5 12c-.3-1.2.3-2.4 1.4-2.9l.8-.4c.6-.3 1.3-.2 1.8.2l1.1.9 1.1-.9c.5-.4 1.2-.5 1.8-.2l.8.4c1.1.5 1.7 1.7 1.4 2.9l-.9 4.2c-.3.9-.9 1.6-1.7 2-.9.5-2 .5-2.9 0z"
          fill={fillPray}
          stroke={stroke}
          strokeWidth={active ? 0 : 0.35}
        />
        <Path
          d="M9.2 7.8c0-1.3 1-2.4 2.3-2.5h.9c1.3.1 2.3 1.2 2.3 2.5v1.1H9.2V7.8z"
          fill={active && prayActiveOnWarmBackground ? colors.accent : active ? "#FDBA74" : INACTIVE}
        />
      </Svg>
    );
  }

  if (kind === "comment") {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M5.5 6.5h13a2 2 0 012 2v6.5a2 2 0 01-2 2h-8.2L6.2 19.5v-2.5H5.5a2 2 0 01-2-2V8.5a2 2 0 012-2z"
          fill={fillComment}
          stroke={stroke}
          strokeWidth={active ? 0 : 0.35}
        />
      </Svg>
    );
  }

  if (kind === "save") {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M7.5 3.5h9v17l-4.5-2.2L7.5 20.5v-17z"
          fill="none"
          stroke={fillSave}
          strokeWidth={active ? 2.2 : 2}
          strokeLinejoin="round"
        />
        <Path d="M9.5 8h5M9.5 12h5M9.5 16h5" stroke={fillSave} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    );
  }

  // share
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={shareGradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={active ? "#7C3AED" : INACTIVE} />
          <Stop offset="55%" stopColor={active ? "#EC4899" : INACTIVE} />
          <Stop offset="100%" stopColor={fillShareEnd} />
        </LinearGradient>
      </Defs>
      <Path
        d="M6 18.5c2.8 0 5-2.2 5-5V8.2m0 0l2.2 2.2M11 8.2L8.8 10.4"
        fill="none"
        stroke={active ? `url(#${shareGradId})` : INACTIVE}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.5 6.5h4.5a1.5 1.5 0 011.5 1.5v4.5"
        fill="none"
        stroke={active ? `url(#${shareGradId})` : INACTIVE}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
