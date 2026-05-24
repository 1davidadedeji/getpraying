/** App mark used on welcome, sign-in, register, and splash. */
export const APP_LOGO_SOURCE = require("../assets/images/icon-bg.png");

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
