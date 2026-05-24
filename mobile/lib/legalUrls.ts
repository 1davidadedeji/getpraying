export const TERMS_URL = "https://getpraying.com/terms";
export const PRIVACY_URL = "https://getpraying.com/privacy";

/** Default welcome-screen verse when API is unavailable (matches manual mode default). */
export const DEFAULT_DAILY_QUOTE = "The righteous cry out, and the Lord hears them.";
export const DEFAULT_DAILY_REFERENCE = "— Psalm 34:17";

export const WELCOME_TAGLINE_LINES = [
  "Share your prayers.",
  "Find Support.",
  "Join Now.",
] as const;

/** Single-line welcome tagline with light spacing between sentences. */
export const WELCOME_TAGLINE = WELCOME_TAGLINE_LINES.join("  ");
