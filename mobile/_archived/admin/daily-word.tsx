import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetDailyWordQueryKey,
  useClearDailyWordOverride,
  useGetDailyWord,
  useSetDailyWordOverride,
} from "@workspace/api-client-react";
import { showAppAlert } from "@/components/AppAlert";
import colors from "@/constants/colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { formatLocalYMD } from "@/lib/date";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { clamp } from "@/lib/responsiveMetrics";

export default function AdminDailyWordScreen() {
  const insets = useSafeAreaInsets();
  const [dateStr, setDateStr] = useState(() => formatLocalYMD(new Date()));
  const [quoteText, setQuoteText] = useState("");
  const [reference, setReference] = useState("");
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim());

  const trimmedDate = dateStr.trim();
  const { data: word, refetch: refetchWord } = useGetDailyWord(
    { date: trimmedDate },
    {
      query: {
        queryKey: getGetDailyWordQueryKey({ date: trimmedDate }),
        enabled: dateOk,
        retry: 1,
      },
    },
  );

  useEffect(() => {
    if (!word) return;
    setQuoteText(word.quoteText);
    setReference(word.reference);
  }, [word?.date, word?.quoteText, word?.reference]);

  const setOverride = useSetDailyWordOverride();
  const clearOverride = useClearDailyWordOverride();

  const onSave = () => {
    const d = dateStr.trim();
    const qt = quoteText.trim();
    const ref = reference.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !qt || !ref) {
      showAppAlert({
        title: "Check fields",
        message: "Use date YYYY-MM-DD and fill in both quote and reference.",
      });
      return;
    }
    setOverride.mutate(
      { data: { effectiveDate: d, quoteText: qt, reference: ref } },
      {
        onSuccess: () => {
          showAppAlert({
            title: "Saved",
            message: "Daily Word for that date has been updated.",
          });
          refetchWord();
        },
        onError: (e: unknown) =>
          showAppAlert({ title: "Save failed", message: getApiErrorMessage(e, "Try again") }),
      },
    );
  };

  const onClear = () => {
    const d = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      showAppAlert({ title: "Invalid date", message: "Use YYYY-MM-DD." });
      return;
    }
    clearOverride.mutate(
      { params: { date: d } },
      {
        onSuccess: () => {
          showAppAlert({
            title: "Cleared",
            message: "That date will use the default verse again (manual or auto, depending on settings).",
          });
          refetchWord();
        },
        onError: (e: unknown) =>
          showAppAlert({ title: "Clear failed", message: getApiErrorMessage(e, "Try again") }),
      },
    );
  };

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 20 : 8;
  const { gutter, uiScale } = useResponsiveLayout();
  const pad = gutter;
  const scrollBot = Math.round(clamp(24 * uiScale, 20, 30));
  const fsTitle = Math.round(clamp(17 * uiScale, 15, 20));
  const titleMb = Math.round(clamp(8 * uiScale, 6, 10));
  const fsHint = Math.round(clamp(12 * uiScale, 11, 13));
  const lhHint = Math.round(fsHint * 1.45);
  const hintMb = Math.round(clamp(12 * uiScale, 10, 14));
  const fsLabel = Math.round(clamp(11 * uiScale, 10, 12));
  const labelMt = Math.round(clamp(4 * uiScale, 3, 5));
  const fsInput = Math.round(clamp(15 * uiScale, 14, 16));
  const inputRad = Math.round(clamp(14 * uiScale, 12, 16));
  const inputPadH = Math.round(clamp(14 * uiScale, 12, 16));
  const inputPadV = Math.round(clamp(10 * uiScale, 8, 12));
  const inputMb = Math.round(clamp(4 * uiScale, 3, 5));
  const multiMinH = Math.round(clamp(72 * uiScale, 64, 88));
  const rowGap = Math.round(clamp(10 * uiScale, 8, 12));
  const rowMt = Math.round(clamp(16 * uiScale, 14, 20));
  const btnRad = Math.round(clamp(14 * uiScale, 12, 16));
  const btnPadV = Math.round(clamp(12 * uiScale, 10, 14));
  const fsBtn = Math.round(clamp(14 * uiScale, 13, 16));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{
        padding: pad,
        paddingTop: topPad,
        paddingBottom: botPad + scrollBot,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.cardTitle, { fontSize: fsTitle, marginBottom: titleMb }]}>
        {"Today's Word (override)"}
      </Text>
      <Text style={[styles.hint, { fontSize: fsHint, lineHeight: lhHint, marginBottom: hintMb }]}>
        Set a custom verse for a calendar date, or clear to revert to the default (Psalm 34:17 in manual mode, or the daily rotation when auto is on).{" "}
        ({word?.source === "override" ? "this date has an override" : "this date uses the default"}).
      </Text>
      <Text style={[styles.label, { fontSize: fsLabel, marginTop: labelMt }]}>Date (YYYY-MM-DD)</Text>
      <TextInput
        value={dateStr}
        onChangeText={setDateStr}
        placeholder="2026-04-07"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            fontSize: fsInput,
            borderRadius: inputRad,
            paddingHorizontal: inputPadH,
            paddingVertical: inputPadV,
            marginBottom: inputMb,
          },
        ]}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={[styles.label, { fontSize: fsLabel, marginTop: labelMt }]}>Quote</Text>
      <TextInput
        value={quoteText}
        onChangeText={setQuoteText}
        placeholder="Verse text"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          styles.inputMultiline,
          {
            fontSize: fsInput,
            borderRadius: inputRad,
            paddingHorizontal: inputPadH,
            paddingVertical: inputPadV,
            marginBottom: inputMb,
            minHeight: multiMinH,
          },
        ]}
        multiline
      />
      <Text style={[styles.label, { fontSize: fsLabel, marginTop: labelMt }]}>Reference</Text>
      <TextInput
        value={reference}
        onChangeText={setReference}
        placeholder="— Psalm 23:1"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            fontSize: fsInput,
            borderRadius: inputRad,
            paddingHorizontal: inputPadH,
            paddingVertical: inputPadV,
            marginBottom: inputMb,
          },
        ]}
        autoCapitalize="none"
      />
      <View style={[styles.row, { gap: rowGap, marginTop: rowMt }]}>
        <Pressable
          style={[
            styles.btn,
            styles.btnPrimary,
            { borderRadius: btnRad, paddingVertical: btnPadV },
            setOverride.isPending && styles.btnDisabled,
          ]}
          onPress={onSave}
          disabled={setOverride.isPending}
        >
          {setOverride.isPending ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <Text style={[styles.btnPrimaryText, { fontSize: fsBtn }]}>Save override</Text>
          )}
        </Pressable>
        <Pressable
          style={[
            styles.btn,
            styles.btnGhost,
            { borderRadius: btnRad, paddingVertical: btnPadV },
            clearOverride.isPending && styles.btnDisabled,
          ]}
          onPress={onClear}
          disabled={clearOverride.isPending}
        >
          {clearOverride.isPending ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Text style={[styles.btnGhostText, { fontSize: fsBtn }]}>Clear</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontFamily: "NotoSerif_700Bold",
    color: colors.primary,
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.muted,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: colors.success,
  },
  btnPrimaryText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.surface,
  },
  btnGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  btnGhostText: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.danger,
  },
  btnDisabled: { opacity: 0.6 },
});
