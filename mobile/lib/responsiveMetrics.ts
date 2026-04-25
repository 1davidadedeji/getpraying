import { LAYOUT } from "@/constants/layout";

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const REF_SHORT = 390;

/**
 * Gentle scale from the shorter window side so layout adapts to orientation
 * and large phones without jumping wildly.
 */
export function getUiScale(width: number, height: number): number {
  const short = Math.min(width, height);
  return clamp(short / REF_SHORT, 0.9, 1.14);
}

export function getIsLandscape(width: number, height: number): boolean {
  return width > height;
}

/** Horizontal inset for scroll/list content (orientation-aware). */
export function getGutter(width: number, height: number): number {
  const w = Math.max(320, width);
  const landscape = width > height;
  let g: number;
  if (w < 360) g = 12;
  else if (w >= 1024) g = 24;
  else if (w >= LAYOUT.tabletMinWidth) g = 20;
  else g = 16;
  if (landscape && height < 420 && w < LAYOUT.tabletMinWidth) {
    g = clamp(g - 2, 12, g);
  }
  return g;
}

export function getIconTab(uiScale: number): number {
  return Math.round(clamp(24 * uiScale, 20, 28));
}

export function getIconAction(uiScale: number): number {
  return Math.round(clamp(22 * uiScale, 19, 26));
}

export function getFabSize(uiScale: number): number {
  return Math.round(clamp(56 * uiScale, 52, 64));
}

export function getCardRadius(uiScale: number): number {
  return Math.round(clamp(32 * uiScale, 28, 38));
}

/** Library situation grid: more columns when tablet or phone landscape is wide enough. */
export function getLibrarySituationCols(width: number, height: number, isTablet: boolean): number {
  if (isTablet) return 4;
  if (width > height && width >= 680) return 4;
  return 3;
}

export function getLibraryIconBgSize(uiScale: number): number {
  return Math.round(clamp(44 * uiScale, 40, 52));
}
