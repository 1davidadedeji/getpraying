import { Feather } from "@expo/vector-icons";
import { reloadAppAsync } from "expo";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { uiScale, gutter } = useResponsiveLayout();

  const ui = useMemo(() => {
    const pad = Math.round(clamp(24 * uiScale, 18, 28));
    const gap = Math.round(clamp(16 * uiScale, 14, 20));
    const titleFs = Math.round(clamp(28 * uiScale, 24, 32));
    const titleLh = Math.round(titleFs * 1.35);
    const msgFs = Math.round(clamp(16 * uiScale, 15, 18));
    const msgLh = Math.round(msgFs * 1.45);
    const btnPadV = Math.round(clamp(16 * uiScale, 14, 18));
    const btnPadH = Math.round(clamp(24 * uiScale, 20, 28));
    const btnFs = Math.round(clamp(16 * uiScale, 15, 18));
    const topBtn = Math.round(clamp(44 * uiScale, 40, 48));
    const topRight = Math.round(clamp(16 * uiScale, 12, 20));
    const topIcon = Math.round(clamp(20 * uiScale, 18, 24));
    const closeIcon = Math.round(clamp(24 * uiScale, 22, 28));
    const modalTitleFs = Math.round(clamp(20 * uiScale, 18, 22));
    const modalPad = Math.round(clamp(16 * uiScale, 14, 20));
    const errTextFs = Math.round(clamp(12 * uiScale, 11, 13));
    const errTextLh = Math.round(errTextFs * 1.45);
    const modalRadius = Math.round(clamp(16 * uiScale, 14, 20));
    const btnMinW = Math.round(clamp(200 * uiScale, 160, 220));
    const devTopPad = Math.round(clamp(16 * uiScale, 12, 20));
    return {
      pad,
      gap,
      titleFs,
      titleLh,
      msgFs,
      msgLh,
      btnPadV,
      btnPadH,
      btnFs,
      topBtn,
      topRight,
      topIcon,
      closeIcon,
      modalTitleFs,
      modalPad,
      errTextFs,
      errTextLh,
      modalRadius,
      btnMinW,
      devTopPad,
    };
  }, [uiScale]);

  const theme = {
    background: isDark ? "#000000" : "#FFFFFF",
    backgroundSecondary: isDark ? "#1C1C1E" : "#F2F2F7",
    text: isDark ? "#FFFFFF" : "#000000",
    textSecondary: isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)",
    link: "#007AFF",
    buttonText: "#FFFFFF",
  };

  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error("Failed to restart app:", restartError);
      resetError();
    }
  };

  const formatErrorDetails = (): string => {
    let details = `Error: ${error.message}\n\n`;
    if (error.stack) {
      details += `Stack Trace:\n${error.stack}`;
    }
    return details;
  };

  const monoFont = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background, padding: ui.pad }]}>
      {__DEV__ ? (
        <Pressable
          onPress={() => setIsModalVisible(true)}
          accessibilityLabel="View error details"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.topButton,
            {
              top: insets.top + ui.devTopPad,
              right: ui.topRight,
              width: ui.topBtn,
              height: ui.topBtn,
              borderRadius: Math.round(clamp(8 * uiScale, 6, 10)),
              backgroundColor: theme.backgroundSecondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="alert-circle" size={ui.topIcon} color={theme.text} />
        </Pressable>
      ) : null}

      <View style={[styles.content, { gap: ui.gap, paddingHorizontal: gutter }]}>
        <Text style={[styles.title, { color: theme.text, fontSize: ui.titleFs, lineHeight: ui.titleLh }]}>
          Something went wrong
        </Text>

        <Text style={[styles.message, { color: theme.textSecondary, fontSize: ui.msgFs, lineHeight: ui.msgLh }]}>
          Please reload the app to continue.
        </Text>

        <Pressable
          onPress={handleRestart}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.link,
              paddingVertical: ui.btnPadV,
              paddingHorizontal: ui.btnPadH,
              minWidth: ui.btnMinW,
              borderRadius: Math.round(clamp(8 * uiScale, 6, 10)),
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText, fontSize: ui.btnFs }]}>
            Try Again
          </Text>
        </Pressable>
      </View>

      {__DEV__ ? (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContainer,
                {
                  backgroundColor: theme.background,
                  borderTopLeftRadius: ui.modalRadius,
                  borderTopRightRadius: ui.modalRadius,
                },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  {
                    borderBottomColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.1)",
                    paddingHorizontal: ui.modalPad,
                    paddingTop: ui.modalPad,
                    paddingBottom: Math.round(ui.modalPad * 0.75),
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.text, fontSize: ui.modalTitleFs }]}>
                  Error Details
                </Text>
                <Pressable
                  onPress={() => setIsModalVisible(false)}
                  accessibilityLabel="Close error details"
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.closeButton,
                    {
                      opacity: pressed ? 0.6 : 1,
                      width: ui.topBtn,
                      height: ui.topBtn,
                    },
                  ]}
                >
                  <Feather name="x" size={ui.closeIcon} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: insets.bottom + ui.modalPad, padding: ui.modalPad },
                ]}
                showsVerticalScrollIndicator
              >
                <View
                  style={[
                    styles.errorContainer,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderRadius: Math.round(clamp(8 * uiScale, 6, 10)),
                      padding: ui.modalPad,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.errorText,
                      {
                        color: theme.text,
                        fontFamily: monoFont,
                        fontSize: ui.errTextFs,
                        lineHeight: ui.errTextLh,
                      },
                    ]}
                    selectable
                  >
                    {formatErrorDetails()}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 600,
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    textAlign: "center",
  },
  topButton: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  button: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontWeight: "600",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    width: "100%",
    height: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontWeight: "600",
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {},
  errorContainer: {
    width: "100%",
    overflow: "hidden",
  },
  errorText: {
    width: "100%",
  },
});
