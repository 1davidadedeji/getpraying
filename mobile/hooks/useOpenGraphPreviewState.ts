import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";

import {
  extractFirstHttpsUrl,
  fetchOpenGraphPreview,
  stripFirstHttpsUrlFromText,
  type LinkPreview,
} from "@/lib/linkPreview";

/** Open Graph preview for the first https URL in a string + optional stripping for display when the card renders. */
export function useOpenGraphPreviewState(content: string, resetKey?: string | number) {
  const urlFromPost = useMemo(() => extractFirstHttpsUrl(content), [content]);
  const [preview, setPreview] = useState<LinkPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    if (!urlFromPost) return () => { cancelled = true; };
    (async () => {
      const p = await fetchOpenGraphPreview(urlFromPost);
      if (!cancelled) setPreview(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [urlFromPost, resetKey]);

  const showLinkPreview =
    Boolean(preview && (preview.title || preview.imageUrl)) && Boolean(urlFromPost);

  const displayTextWithoutUrl = showLinkPreview ? stripFirstHttpsUrlFromText(content) : content;

  const openOutboundLink = useCallback(async () => {
    const href = preview?.url ?? urlFromPost;
    if (!href) return;
    Haptics.selectionAsync();
    try {
      await WebBrowser.openBrowserAsync(href);
    } catch {
      try {
        await Linking.openURL(href);
      } catch {
        /* ignore */
      }
    }
  }, [preview?.url, urlFromPost]);

  const previewHost = useMemo(() => {
    const base = urlFromPost ?? preview?.url;
    if (!base) return "";
    try {
      return new URL(base).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }, [urlFromPost, preview?.url]);

  const previewTitle = (preview?.title?.trim() || previewHost).trim();

  return {
    urlFromPost,
    preview,
    showLinkPreview,
    displayTextWithoutUrl,
    openOutboundLink,
    previewHost,
    previewTitle,
  };
}
