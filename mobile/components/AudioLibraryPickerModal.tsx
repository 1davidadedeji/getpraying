import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { normalizeAudioMime } from "@/lib/audioMime";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

export type AudioLibraryPickResult = {
  uri: string;
  name: string;
  mimeType: string;
};

type Props = {
  visible: boolean;
  maxBytes: number;
  onRequestClose: () => void;
  /** Shown when user chooses “Browse files” (document picker). */
  onBrowseFiles: () => void;
  onChosen: (r: AudioLibraryPickResult) => void;
  onTooLarge?: () => void;
};

function formatDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `0:${s.toString().padStart(2, "0")}`;
}

export function AudioLibraryPickerModal({
  visible,
  maxBytes,
  onRequestClose,
  onBrowseFiles,
  onChosen,
  onTooLarge,
}: Props) {
  const insets = useSafeAreaInsets();
  const { uiScale } = useResponsiveLayout();
  const titleFs = Math.round(clamp(17 * uiScale, 16, 19));
  const bodyFs = Math.round(clamp(14 * uiScale, 13, 16));
  const rowPad = Math.round(clamp(14 * uiScale, 12, 16));
  const iconSz = Math.round(clamp(22 * uiScale, 20, 26));

  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);

  const loadAudio = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setPermissionDenied(false);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setPermissionDenied(true);
        setAssets([]);
        return;
      }
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.audio,
        first: 250,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setAssets(page.assets);
    } catch {
      setLoadError(true);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || Platform.OS === "web") return;
    void loadAudio();
  }, [visible, loadAudio]);

  const handlePickAsset = async (asset: MediaLibrary.Asset) => {
    setPickingId(asset.id);
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset, {
        shouldDownloadFromNetwork: true,
      });
      const localUri = info.localUri ?? info.uri;
      if (!localUri) return;
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      const sz =
        fileInfo.exists && "size" in fileInfo && typeof fileInfo.size === "number" ? fileInfo.size : 0;
      if (sz > maxBytes) {
        onTooLarge?.();
        return;
      }
      const rawName =
        asset.filename && asset.filename.length > 0
          ? asset.filename.replace(/[^\w.\-]+/g, "_")
          : "audio.m4a";
      const mimeType = normalizeAudioMime("application/octet-stream", rawName);
      onChosen({ uri: localUri, name: rawName, mimeType });
      onRequestClose();
    } catch {
      /* ignore */
    } finally {
      setPickingId(null);
    }
  };

  const browseFiles = () => {
    onRequestClose();
    setTimeout(() => onBrowseFiles(), 300);
  };

  if (Platform.OS === "web") return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              paddingTop: Math.round(clamp(12 * uiScale, 10, 14)),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.title, { fontSize: titleFs }]}>Choose audio</Text>
            <Pressable onPress={onRequestClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={iconSz} color={colors.text} />
            </Pressable>
          </View>
          <Text style={[styles.hint, { fontSize: bodyFs - 1 }]}>
            Audio from your library (music, voice memos, downloads). Use “Browse files” if you don’t see it here.
          </Text>

          {loading ? (
            <View style={styles.centerPad}>
              <ActivityIndicator color={colors.flame} />
            </View>
          ) : permissionDenied ? (
            <View style={styles.centerPad}>
              <Text style={[styles.body, { fontSize: bodyFs }]}>
                Media library access is off. You can still attach audio from files.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={browseFiles}>
                <Text style={styles.primaryBtnText}>Browse files</Text>
              </Pressable>
            </View>
          ) : loadError ? (
            <View style={styles.centerPad}>
              <Text style={[styles.body, { fontSize: bodyFs }]}>Could not load audio library.</Text>
              <Pressable style={styles.primaryBtn} onPress={() => void loadAudio()}>
                <Text style={styles.primaryBtnText}>Try again</Text>
              </Pressable>
            </View>
          ) : assets.length === 0 ? (
            <View style={styles.centerPad}>
              <Text style={[styles.body, { fontSize: bodyFs }]}>
                No audio items found in your media library.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={browseFiles}>
                <Text style={styles.primaryBtnText}>Browse files</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={assets}
              keyExtractor={(a) => a.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const dur = item.duration;
                const subtitle = dur > 0 ? formatDur(dur) : "";
                const busy = pickingId === item.id;
                return (
                  <Pressable
                    style={[styles.row, { paddingVertical: rowPad, paddingHorizontal: rowPad }]}
                    onPress={() => void handlePickAsset(item)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.filename ?? "audio"}`}
                  >
                    <Ionicons name="musical-notes-outline" size={iconSz} color={colors.primary} />
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { fontSize: bodyFs }]} numberOfLines={1}>
                        {item.filename ?? "Audio"}
                      </Text>
                      {subtitle ? (
                        <Text style={[styles.rowSub, { fontSize: bodyFs - 2 }]}>{subtitle}</Text>
                      ) : null}
                    </View>
                    {busy ? <ActivityIndicator color={colors.flame} size="small" /> : null}
                  </Pressable>
                );
              }}
            />
          )}

          <Pressable style={styles.secondaryBtn} onPress={browseFiles} accessibilityRole="button">
            <Text style={[styles.secondaryBtnText, { fontSize: bodyFs }]}>Browse all files…</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,31,54,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "78%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.text,
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  centerPad: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 14,
  },
  body: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
    textAlign: "center",
  },
  list: { maxHeight: 360 },
  listContent: { paddingBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: "PlusJakartaSans_600SemiBold", color: colors.text },
  rowSub: { fontFamily: "PlusJakartaSans_400Regular", color: colors.muted, marginTop: 2 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.surface,
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
  },
});
