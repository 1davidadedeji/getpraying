import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { OfficialGuideCard } from "@/components/OfficialGuideCard";
import colors from "@/constants/colors";
import { SAVED_OFFICIAL_EMPTY } from "@/constants/savedOfficialList";
import { useAuth } from "@/context/auth";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { apiFetch } from "@/lib/api";
import { clamp } from "@/lib/responsiveMetrics";

type Props = {
  queryEnabled?: boolean;
  invalidateOnFocus?: boolean;
  listRef?: React.RefObject<FlatList<OfficialPrayerRow> | null>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Defaults to `gutter` from responsive layout */
  paddingHorizontal?: number;
  /** Called with the id after a successful unsave, so parent can sync its savedOfficialIds set */
  onToggleSave?: (id: number) => void;
};

export function SavedOfficialPrayersList({
  queryEnabled = true,
  invalidateOnFocus = false,
  listRef,
  contentContainerStyle,
  paddingHorizontal: paddingHorizontalProp,
  onToggleSave,
}: Props) {
  const { gutter, uiScale } = useResponsiveLayout();
  const paddingHorizontal = paddingHorizontalProp ?? gutter;
  const loaderMt = Math.round(clamp(40 * uiScale, 32, 48));
  const emptyIcon = Math.round(clamp(40 * uiScale, 34, 48));
  const emptyPt = Math.round(clamp(60 * uiScale, 48, 72));
  const emptyGap = Math.round(clamp(10 * uiScale, 8, 12));
  const emptyTitleFs = Math.round(clamp(16 * uiScale, 15, 18));
  const emptySubFs = Math.round(clamp(13 * uiScale, 12, 14));

  const { token } = useAuth();
  const [prayers, setPrayers] = useState<OfficialPrayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    if (!token || !queryEnabled) {
      setPrayers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/library/saved-official", { token });
      if (!res.ok) {
        setPrayers([]);
        return;
      }
      const data = await res.json();
      setPrayers((data as { prayers?: OfficialPrayerRow[] }).prayers ?? []);
    } catch {
      setPrayers([]);
    } finally {
      setLoading(false);
    }
  }, [token, queryEnabled]);

  useFocusEffect(
    useCallback(() => {
      if (invalidateOnFocus && queryEnabled) {
        void load();
      }
    }, [invalidateOnFocus, queryEnabled, load]),
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const toggleSave = async (id: number) => {
    if (!token || removingIds.has(id)) return;

    // Optimistic remove
    setRemovingIds((prev) => new Set([...prev, id]));
    setPrayers((prev) => prev.filter((p) => p.id !== id));
    onToggleSave?.(id);

    try {
      const res = await apiFetch(`/library/saved-official/${id}`, {
        method: "DELETE",
        token,
      });
      if (!res.ok) {
        // Revert: reload list on failure
        void load();
      }
    } catch {
      void load();
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <FlatList
      ref={listRef}
      data={loading ? [] : prayers}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal }}>
          <OfficialGuideCard
            op={item}
            showSave
            isSaved
            onToggleSave={() => void toggleSave(item.id)}
          />
        </View>
      )}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: loaderMt }} />
        ) : (
          <View style={[styles.emptyState, { paddingTop: emptyPt, gap: emptyGap }]}>
            <Ionicons name="bookmark-outline" size={emptyIcon} color={colors.muted} />
            <Text style={[styles.emptyText, { fontSize: emptyTitleFs }]}>{SAVED_OFFICIAL_EMPTY.title}</Text>
            <Text style={[styles.emptySubtext, { fontSize: emptySubFs }]}>{SAVED_OFFICIAL_EMPTY.subtitle}</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  emptySubtext: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
});
