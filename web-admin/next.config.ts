import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Avoid inheriting a CDN/asset prefix in dev — misconfigured NEXT_PUBLIC_* / proxies can break /_next URLs.
   * Set NEXT_ASSET_PREFIX only for production deploys that truly need it.
   */
  assetPrefix:
    process.env.NODE_ENV === "production" && process.env.NEXT_ASSET_PREFIX?.trim()
      ? process.env.NEXT_ASSET_PREFIX.trim()
      : undefined,
};

export default nextConfig;
