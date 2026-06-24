import { PRIVACY_URL, TERMS_URL } from "@/lib/legalUrls";
import { openLegalDocument } from "@/lib/openLegalDocument";
import colors from "@/constants/colors";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  fontSize?: number;
};

export function TermsOfServiceAgreement({ checked, onCheckedChange, fontSize = 13 }: Props) {
  const fs = fontSize;
  const lh = Math.round(fs * 1.45);

  return (
    <Pressable
      style={styles.checkRow}
      onPress={() => onCheckedChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Feather name="check" size={14} color={colors.surface} /> : null}
      </View>
      <Text style={[styles.checkLabel, { fontSize: fs, lineHeight: lh }]}>
        I agree to the{" "}
        <Text
          style={styles.link}
          onPress={(e) => {
            e.stopPropagation?.();
            void openLegalDocument(TERMS_URL);
          }}
          accessibilityRole="link"
        >
          Terms of Service
        </Text>
        {" and "}
        <Text
          style={styles.link}
          onPress={(e) => {
            e.stopPropagation?.();
            void openLegalDocument(PRIVACY_URL);
          }}
          accessibilityRole="link"
        >
          Privacy Policy
        </Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkLabel: {
    flex: 1,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.text,
  },
  link: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.accent,
  },
});
