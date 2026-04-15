import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import colors from "@/constants/colors";

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
  const { width } = useWindowDimensions();
  const narrow = width < 400;
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
      setTimeout(() => { void fn?.(); }, 100);
    },
    [dismiss],
  );

  if (!cfg) return null;

  const buttons = cfg.buttons ?? [{ text: "OK", style: "default" as const }];
  const allowBackdropDismiss = buttons.length <= 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable
        style={styles.backdrop}
        onPress={allowBackdropDismiss ? dismiss : undefined}
        accessibilityRole="button"
      >
        <Pressable
          style={[styles.card, narrow && styles.cardNarrow]}
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
        >
          <Text style={styles.title}>{cfg.title}</Text>
          {cfg.message ? <Text style={styles.message}>{cfg.message}</Text> : null}
          <View style={[styles.actions, buttons.length > 2 && styles.actionsStack]}>
            {buttons.map((b, i) => {
              const isCancel = b.style === "cancel";
              const isDest = b.style === "destructive";
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => onPressBtn(b)}
                  style={({ pressed }) => [
                    styles.btn,
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
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardNarrow: {
    padding: 18,
  },
  title: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 20,
    color: colors.primary,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  actionsStack: {
    flexDirection: "column",
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    minWidth: 120,
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
    borderWidth: 1.5,
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
    fontSize: 15,
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
