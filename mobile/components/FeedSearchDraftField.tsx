import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import colors from "@/constants/colors";

const chrome = StyleSheet.create({
  feedSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feedSearchInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.text,
    paddingVertical: 4,
    minWidth: 0,
  },
  clearHit: {
    padding: 4,
  },
});

/**
 * Keeps draft text in this subtree so the parent screen does not re-render on each keystroke.
 * Re-rendering the feed was remounting the FlatList header and dropping focus after one character.
 */
export function FeedSearchDraftField({
  committedQuery,
  onSubmitQuery,
  onDebouncedQuery,
  debounceMs = 420,
  onClearCommitted,
  marginBottom = 12,
  feedSearchFs,
  searchIconSize,
  clearIconSize = 20,
  placeholder,
  autoFocus,
  accessibilityLabel,
}: {
  committedQuery: string;
  onSubmitQuery: (q: string) => void;
  /** Fired after typing pauses; parent should no-op when trim length < 2. */
  onDebouncedQuery?: (q: string) => void;
  debounceMs?: number;
  /** Parent clears server results / committed query when user taps clear. */
  onClearCommitted?: () => void;
  marginBottom?: number;
  feedSearchFs: number;
  searchIconSize: number;
  clearIconSize?: number;
  placeholder: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}) {
  const [text, setText] = useState(committedQuery);

  useEffect(() => {
    setText(committedQuery);
  }, [committedQuery]);

  useEffect(() => {
    if (!onDebouncedQuery) return undefined;
    const t = setTimeout(() => onDebouncedQuery(text), debounceMs);
    return () => clearTimeout(t);
  }, [debounceMs, onDebouncedQuery, text]);

  const showClear = text.length > 0;

  return (
    <View style={[chrome.feedSearchWrap, { marginBottom }]}>
      <Ionicons name="search" size={searchIconSize} color={colors.muted} />
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => onSubmitQuery(text)}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[chrome.feedSearchInput, { fontSize: feedSearchFs }]}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
      />
      {showClear ? (
        <Pressable
          onPress={() => {
            setText("");
            onClearCommitted?.();
          }}
          hitSlop={10}
          style={chrome.clearHit}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={clearIconSize} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
