/**
 * In-app brand mark (cream-background screens, native splash).
 * OS app icon / notifications use `assets/images/icon.png` via app.json.
 */
export const APP_LOGO_SOURCE = require("../assets/images/icon-bg.png");

/** Matches native splash `imageWidth` in app.json — single canonical splash size. */
export function splashLogoSizePx(uiScale: number): number {
  const size = 280 * uiScale;
  return Math.round(Math.max(240, Math.min(300, size)));
}

/** Sign-in / register logo sizing. */
export function appLogoSizePx(uiScale: number): number {
  const size = 140 * uiScale;
  return Math.round(Math.max(116, Math.min(158, size)));
}

/** Slightly larger mark on the welcome / daily word screen. */
export function welcomeLogoSizePx(uiScale: number): number {
  const size = 164 * uiScale;
  return Math.round(Math.max(136, Math.min(184, size)));
}
