/**
 * Welcome / auth mark (ladder on transparent). OS app icon and native splash
 * use `assets/images/icon.png`; Android notification tray uses
 * `assets/images/notification-icon.png` via app.json.
 */
export const APP_LOGO_SOURCE = require("../assets/images/icon-bg.png");

/** Full app tile — native splash and JS bootstrap loading only. */
export const SPLASH_LOGO_SOURCE = require("../assets/images/icon.png");

/** Cream fill sampled from icon.png — splash `backgroundColor` in app.json. */
export const SPLASH_BACKGROUND_COLOR = "#F5EFE3";

/** Fixed logical px — must match native splash `imageWidth` in app.json. */
export const SPLASH_LOGO_SIZE_PX = 280;

/** @deprecated Use SPLASH_LOGO_SIZE_PX — splash logo is fixed to match native splash. */
export function splashLogoSizePx(_uiScale: number): number {
  return SPLASH_LOGO_SIZE_PX;
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
