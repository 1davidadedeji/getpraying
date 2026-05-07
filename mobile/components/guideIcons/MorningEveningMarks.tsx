/**
 * Morning / evening slot art aligned with bundled assets (`morning_icon.svg`, `evening_icon.svg`).
 * Uses react-native-svg (no SVG metro transformer required).
 */
import React, { useId } from "react";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from "react-native-svg";

function sanitizeId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

/** 64×64 art from `morning_icon.svg`. */
export function MorningGuideMark({ size }: { size: number }) {
  const suffix = sanitizeId(useId());
  const bgKey = `bgMorning_${suffix}`;
  const sunKey = `sunGradient_${suffix}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={bgKey} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#EAF2FF" />
          <Stop offset="100%" stopColor="#D6E6FF" />
        </LinearGradient>
        <LinearGradient id={sunKey} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFD76A" />
          <Stop offset="100%" stopColor="#FFB347" />
        </LinearGradient>
      </Defs>
      <Circle cx="32" cy="32" r="30" fill={`url(#${bgKey})`} />
      <Path d="M12 40 Q32 28 52 40 L52 48 L12 48 Z" fill="#6FA8FF" />
      <Circle cx="32" cy="34" r="8" fill={`url(#${sunKey})`} />
      <G stroke="#FFD76A" strokeWidth="2" strokeLinecap="round">
        <Line x1="32" y1="20" x2="32" y2="14" />
        <Line x1="20" y1="24" x2="16" y2="20" />
        <Line x1="44" y1="24" x2="48" y2="20" />
      </G>
    </Svg>
  );
}

/** 64×64 art from `evening_icon.svg`. */
export function EveningGuideMark({ size }: { size: number }) {
  const suffix = sanitizeId(useId());
  const bgKey = `bgEvening_${suffix}`;
  const moonKey = `moonGradient_${suffix}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={bgKey} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#F3E8D9" />
          <Stop offset="100%" stopColor="#EADFCC" />
        </LinearGradient>
        <LinearGradient id={moonKey} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFE6A7" />
          <Stop offset="100%" stopColor="#FFC96B" />
        </LinearGradient>
      </Defs>
      <Circle cx="32" cy="32" r="30" fill={`url(#${bgKey})`} />
      <Circle cx="32" cy="32" r="30" fill="#5B4A6B" opacity={0.25} />
      <Path
        d="M38 20 A10 10 0 1 0 44 40 A8 8 0 1 1 38 20 Z"
        fill={`url(#${moonKey})`}
      />
      <Circle cx="22" cy="22" r="1.5" fill="#FFE6A7" />
      <Circle cx="46" cy="26" r="1.2" fill="#FFE6A7" />
      <Circle cx="40" cy="18" r="1" fill="#FFE6A7" />
    </Svg>
  );
}
