import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import { extractFirstHttpsUrl, fetchOpenGraphPreview, type LinkPreview } from "@/lib/linkPreview";

type Props = {
  content: string;
};

/** OpenGraph card for a single URL in comment text (matches feed post link preview styling). */
export function CommentLinkPreview({ content }: Props) {
  const urlFromText = useMemo(() => extractFirstHttpsUrl(content), [content]);
  const [preview, setPreview] = useState<LinkPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    if (!urlFromText) return () => { cancelled = true; };
    void (async () => {
      const p = await fetchOpenGraphPreview(urlFromText);
      if (!cancelled) setPreview(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [urlFromText]);

  const openOutbound = useCallback(async () => {
    const href = preview?.url ?? urlFromText;
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
  }, [preview?.url, urlFromText]);

  const previewHost = useMemo(() => {
    if (!preview?.url) return "";
    try {
      return new URL(preview.url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }, [preview?.url]);

  const previewTitle = (preview?.title?.trim() || previewHost).trim();

  const showCard =
    Boolean(preview && (preview.title || preview.imageUrl)) && Boolean(urlFromText);

  if (!showCard || !preview) return null;

  return (
    <Pressable
      onPress={() => void openOutbound()}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="link"
      accessibilityLabel={`Open link: ${previewTitle || previewHost}`}
    >
      {preview.imageUrl ? (
        <Image source={{ uri: preview.imageUrl }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="link-outline" size={22} color={colors.muted} />
        </View>
      )}
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={3}>
          {previewTitle || previewHost}
        </Text>
        {previewHost ? (
          <Text style={styles.host} numberOfLines={1}>
            {previewHost}
          </Text>
        ) : null}
      </View>
      <Ionicons name="open-outline" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.88,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
  },
  host: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
