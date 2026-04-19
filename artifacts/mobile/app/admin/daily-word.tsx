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
import { formatLocalYMD } from "@/lib/date";
import { getApiErrorMessage } from "@/lib/apiErrors";

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
            message: "That date will use the automatic daily rotation again.",
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: 16, paddingTop: topPad, paddingBottom: botPad + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.cardTitle}>{"Today's Word (override)"}</Text>
      <Text style={styles.hint}>
        Set a custom verse for a calendar date, or clear to use the automatic rotation (
        {word?.source === "override" ? "this date has an override" : "this date uses defaults"}).
      </Text>
      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput
        value={dateStr}
        onChangeText={setDateStr}
        placeholder="2026-04-07"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.label}>Quote</Text>
      <TextInput
        value={quoteText}
        onChangeText={setQuoteText}
        placeholder="Verse text"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.inputMultiline]}
        multiline
      />
      <Text style={styles.label}>Reference</Text>
      <TextInput
        value={reference}
        onChangeText={setReference}
        placeholder="— Psalm 23:1"
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="none"
      />
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnPrimary, setOverride.isPending && styles.btnDisabled]}
          onPress={onSave}
          disabled={setOverride.isPending}
        >
          {setOverride.isPending ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>Save override</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnGhost, clearOverride.isPending && styles.btnDisabled]}
          onPress={onClear}
          disabled={clearOverride.isPending}
        >
          {clearOverride.isPending ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Text style={styles.btnGhostText}>Clear</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    fontFamily: "NotoSerif_700Bold",
    fontSize: 17,
    color: colors.primary,
    marginBottom: 8,
  },
  hint: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 18,
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  input: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: colors.success,
  },
  btnPrimaryText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.surface,
  },
  btnGhost: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  btnGhostText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.danger,
  },
  btnDisabled: { opacity: 0.6 },
});
