import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { OfficialGuideCard } from "@/components/OfficialGuideCard";
import colors from "@/constants/colors";
import { SAVED_OFFICIAL_EMPTY } from "@/constants/savedOfficialList";
import { useAuth } from "@/context/auth";
import type { OfficialPrayerRow } from "@/lib/officialPrayer";
import { apiUrl, authHeaders } from "@/lib/api";

type Props = {
  queryEnabled?: boolean;
  invalidateOnFocus?: boolean;
  listRef?: React.RefObject<FlatList<OfficialPrayerRow> | null>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  paddingHorizontal?: number;
};

export function SavedOfficialPrayersList({
  queryEnabled = true,
  invalidateOnFocus = false,
  listRef,
  contentContainerStyle,
  paddingHorizontal = 16,
}: Props) {
  const { token } = useAuth();
  const [prayers, setPrayers] = useState<OfficialPrayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !queryEnabled) {
      setPrayers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/library/saved-official"), { headers: authHeaders(token) });
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
    if (!token) return;
    const res = await fetch(apiUrl(`/library/saved-official/${id}`), {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (res.ok) {
      setPrayers((prev) => prev.filter((p) => p.id !== id));
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
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="bookmark-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>{SAVED_OFFICIAL_EMPTY.title}</Text>
            <Text style={styles.emptySubtext}>{SAVED_OFFICIAL_EMPTY.subtitle}</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 16,
    color: colors.primary,
  },
  emptySubtext: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
});
