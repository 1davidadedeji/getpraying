import React, { useRef } from "react";
import {
  Keyboard,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

export const OTP_LENGTH = 6;

export type OtpBoxInputProps = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
  length?: number;
  autoFocus?: boolean;
};

export function OtpBoxInput({
  value,
  onChange,
  onComplete,
  length = OTP_LENGTH,
  autoFocus,
}: OtpBoxInputProps) {
  const { uiScale } = useResponsiveLayout();
  const boxW = Math.round(clamp(48 * uiScale, 40, 54));
  const boxH = Math.round(clamp(56 * uiScale, 48, 62));
  const boxRad = Math.round(clamp(16 * uiScale, 14, 18));
  const boxFs = Math.round(clamp(22 * uiScale, 20, 26));
  const rowGap = Math.round(clamp(8 * uiScale, 6, 10));
  const borderW = Math.max(1, Math.round(2 * uiScale));
  const refs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(length, "").split("").slice(0, length);

  const dismissKeyboard = () => {
    refs.current.forEach((r) => r?.blur());
    Keyboard.dismiss();
  };

  const finishEntry = () => {
    dismissKeyboard();
    onComplete?.();
  };

  const handleChange = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, length);
      onChange(pasted);
      if (pasted.length === length) {
        finishEntry();
      } else {
        const focusIdx = Math.min(pasted.length, length - 1);
        refs.current[focusIdx]?.focus();
      }
      return;
    }
    const arr = digits.slice();
    arr[index] = cleaned;
    const newVal = arr.join("").replace(/\s/g, "");
    onChange(newVal);
    if (cleaned && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
    if (newVal.length === length) {
      finishEntry();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
      const arr = digits.slice();
      arr[index - 1] = "";
      onChange(arr.join("").replace(/\s/g, ""));
    }
  };

  return (
    <View style={[styles.row, { gap: rowGap }]}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          style={[
            styles.box,
            {
              width: boxW,
              height: boxH,
              borderRadius: boxRad,
              fontSize: boxFs,
              borderWidth: borderW,
            },
            digits[i]?.trim() ? styles.boxFilled : null,
          ]}
          value={digits[i]?.trim() ?? ""}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={length}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          selectTextOnFocus
          autoFocus={autoFocus && i === 0}
          testID={`otp-box-${i}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
  },
  box: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.text,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.cream,
  },
});
