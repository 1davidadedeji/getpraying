import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetPath } from "@workspace/api-client-react";
import colors from "@/constants/colors";

export default function PathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useGetPath(Number(id));

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const path = data as any;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!path) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Prayer path not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{ paddingBottom: botPad + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Feather name="compass" size={32} color={colors.surface} />
        </View>
        <Text style={styles.heroTitle}>{path.title}</Text>
        {path.description && (
          <Text style={styles.heroDesc}>{path.description}</Text>
        )}
        <View style={styles.heroMeta}>
          <Ionicons name="book-outline" size={16} color={colors.accent} />
          <Text style={styles.heroMetaText}>
            {path.prayers?.length ?? 0} prayers in this path
          </Text>
        </View>
      </View>

      <View style={styles.prayersSection}>
        <Text style={styles.sectionTitle}>Prayers in this Path</Text>
        {(path.prayers ?? []).map((prayer: any, idx: number) => (
          <View key={prayer.id} style={styles.prayerItem}>
            <View style={styles.prayerNumber}>
              <Text style={styles.prayerNumberText}>{idx + 1}</Text>
            </View>
            <View style={styles.prayerContent}>
              <Text style={styles.prayerTitle}>{prayer.title}</Text>
              {prayer.author && (
                <Text style={styles.prayerAuthor}>— {prayer.author}</Text>
              )}
              <Text style={styles.prayerBody}>{prayer.body}</Text>
            </View>
          </View>
        ))}
        {(path.prayers ?? []).length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyText}>No prayers added to this path yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  centered: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: colors.muted,
  },
  heroSection: {
    backgroundColor: colors.primary,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(212,160,67,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,160,67,0.4)",
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: colors.surface,
    textAlign: "center",
  },
  heroDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  heroMetaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.accent,
  },
  prayersSection: {
    padding: 20,
    gap: 16,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  prayerItem: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prayerNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  prayerNumberText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: colors.accent,
  },
  prayerContent: {
    flex: 1,
    gap: 4,
  },
  prayerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.text,
  },
  prayerAuthor: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
  },
  prayerBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.muted,
  },
});
