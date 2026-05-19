import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

export type AppAlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

export type AppAlertConfig = {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
};

let dispatchAlert: ((c: AppAlertConfig) => void) | null = null;

export function showAppAlert(config: AppAlertConfig): void {
  if (!dispatchAlert) {
    console.warn("[AppAlert] Host not mounted —", config.title);
    return;
  }
  dispatchAlert(config);
}

export function AppAlertHost() {
  const { uiScale, gutter } = useResponsiveLayout();
  const backdropPad = Math.round(clamp(28 * uiScale, Math.max(16, gutter), 36));
  const cardPad = Math.round(clamp(22 * uiScale, 18, 26));
  const cardRad = Math.round(clamp(28 * uiScale, 24, 32));
  const cardMaxW = Math.round(clamp(400 * uiScale, 300, 440));
  const borderW = Math.max(1, Math.round(uiScale));
  const titleFs = Math.round(clamp(20 * uiScale, 18, 24));
  const titleMb = Math.round(clamp(8 * uiScale, 6, 10));
  const msgFs = Math.round(clamp(15 * uiScale, 14, 17));
  const msgLh = Math.round(msgFs * 1.45);
  const msgMb = Math.round(clamp(20 * uiScale, 16, 24));
  const actionsGap = Math.round(clamp(10 * uiScale, 8, 12));
  const btnPadV = Math.round(clamp(14 * uiScale, 12, 16));
  const btnPadH = Math.round(clamp(20 * uiScale, 16, 24));
  const btnMinW = Math.round(clamp(120 * uiScale, 100, 140));
  const btnLabelFs = Math.round(clamp(15 * uiScale, 14, 16));
  const cancelBorderW = Math.max(1, Math.round(1.5 * uiScale));

  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState<AppAlertConfig | null>(null);

  useEffect(() => {
    dispatchAlert = (c) => {
      setCfg({
        title: c.title,
        message: c.message,
        buttons: c.buttons?.length ? c.buttons : [{ text: "OK", style: "default" }],
      });
      setVisible(true);
    };
    return () => {
      dispatchAlert = null;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => setCfg(null), 350);
  }, []);

  const onPressBtn = useCallback(
    (btn: AppAlertButton) => {
      const fn = btn.onPress;
      dismiss();
      setTimeout(() => {
        void fn?.();
      }, 320);
    },
    [dismiss],
  );

  if (!cfg) return null;

  const buttons = cfg.buttons ?? [{ text: "OK", style: "default" as const }];
  const allowBackdropDismiss = buttons.length <= 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable
        style={[styles.backdrop, { paddingHorizontal: backdropPad }]}
        onPress={allowBackdropDismiss ? dismiss : undefined}
        accessibilityRole="button"
      >
        <Pressable
          style={[
            styles.card,
            {
              padding: cardPad,
              borderRadius: cardRad,
              maxWidth: cardMaxW,
              borderWidth: borderW,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
        >
          <Text style={[styles.title, { fontSize: titleFs, marginBottom: titleMb }]}>{cfg.title}</Text>
          {cfg.message ? (
            <Text style={[styles.message, { fontSize: msgFs, lineHeight: msgLh, marginBottom: msgMb }]}>
              {cfg.message}
            </Text>
          ) : null}
          <View style={[styles.actions, { gap: actionsGap }, buttons.length > 2 && styles.actionsStack]}>
            {buttons.map((b, i) => {
              const isCancel = b.style === "cancel";
              const isDest = b.style === "destructive";
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => onPressBtn(b)}
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      paddingVertical: btnPadV,
                      paddingHorizontal: btnPadH,
                      minWidth: btnMinW,
                      borderWidth: isCancel ? cancelBorderW : 0,
                    },
                    isCancel && styles.btnCancel,
                    isDest && styles.btnDestructive,
                    !isCancel && !isDest && styles.btnPrimary,
                    buttons.length > 2 && styles.btnFullWidth,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.btnLabel,
                      { fontSize: btnLabelFs },
                      isCancel && styles.btnLabelCancel,
                      isDest && styles.btnLabelDestructive,
                      !isCancel && !isDest && styles.btnLabelPrimary,
                    ]}
                  >
                    {b.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    alignSelf: "center",
    width: "100%",
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
    textAlign: "center",
  },
  message: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  actionsStack: {
    flexDirection: "column",
  },
  btn: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  btnFullWidth: {
    width: "100%",
    minWidth: undefined,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnCancel: {
    backgroundColor: colors.cream,
    borderColor: colors.border,
  },
  btnDestructive: {
    backgroundColor: colors.danger,
  },
  btnPressed: {
    opacity: 0.88,
  },
  btnLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
  },
  btnLabelPrimary: {
    color: colors.surface,
  },
  btnLabelCancel: {
    color: colors.textSecondary,
  },
  btnLabelDestructive: {
    color: colors.surface,
  },
});
