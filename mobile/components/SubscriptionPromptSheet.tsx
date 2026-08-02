import React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";
import {
  subscriptionPromptCopy,
  type SubscriptionPromptVariant,
} from "@/lib/subscriptionPromptCopy";

type Props = {
  visible: boolean;
  variant: SubscriptionPromptVariant;
  daysSinceJoined?: number;
  purchasing?: boolean;
  onSubscribe: () => void;
  onNotNow: () => void;
};

export function SubscriptionPromptSheet({
  visible,
  variant,
  daysSinceJoined,
  purchasing = false,
  onSubscribe,
  onNotNow,
}: Props) {
  const { uiScale, gutter } = useResponsiveLayout();
  const backdropPad = Math.round(clamp(28 * uiScale, Math.max(16, gutter), 36));
  const cardPad = Math.round(clamp(22 * uiScale, 18, 26));
  const cardRad = Math.round(clamp(28 * uiScale, 24, 32));
  const cardMaxW = Math.round(clamp(400 * uiScale, 300, 440));
  const titleFs = Math.round(clamp(20 * uiScale, 18, 24));
  const msgFs = Math.round(clamp(15 * uiScale, 14, 17));
  const msgLh = Math.round(msgFs * 1.45);
  const btnPadV = Math.round(clamp(14 * uiScale, 12, 16));
  const btnRad = Math.round(clamp(28 * uiScale, 24, 32));
  const btnLabelFs = Math.round(clamp(15 * uiScale, 14, 16));
  const actionsGap = Math.round(clamp(10 * uiScale, 8, 12));

  const copy = subscriptionPromptCopy(variant, daysSinceJoined);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <View style={[styles.backdrop, { paddingHorizontal: backdropPad }]}>
        <View
          style={[
            styles.card,
            { padding: cardPad, borderRadius: cardRad, maxWidth: cardMaxW },
          ]}
          accessibilityViewIsModal
        >
          <Text style={[styles.title, { fontSize: titleFs }]}>{copy.title}</Text>
          <ScrollView
            style={styles.messageScroll}
            contentContainerStyle={styles.messageScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.message, { fontSize: msgFs, lineHeight: msgLh }]}>{copy.message}</Text>
          </ScrollView>
          <View style={[styles.actions, { gap: actionsGap }]}>
            <Pressable
              onPress={onSubscribe}
              disabled={purchasing}
              style={({ pressed }) => [
                styles.primaryBtn,
                { paddingVertical: btnPadV, borderRadius: btnRad, opacity: pressed || purchasing ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
            >
              {purchasing ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={[styles.primaryBtnText, { fontSize: btnLabelFs }]}>{copy.subscribeLabel}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={onNotNow}
              disabled={purchasing}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { paddingVertical: btnPadV, borderRadius: btnRad, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryBtnText, { fontSize: btnLabelFs }]}>{copy.notNowLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    maxHeight: "82%",
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
    marginBottom: 12,
  },
  messageScroll: {
    maxHeight: 280,
    marginBottom: 16,
  },
  messageScrollContent: {
    paddingBottom: 4,
  },
  message: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  actions: {
    width: "100%",
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
    textAlign: "center",
  },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 48,
  },
  secondaryBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primary,
    textAlign: "center",
  },
});
