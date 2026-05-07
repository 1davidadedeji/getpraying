import { Ionicons } from "@expo/vector-icons";
import React, { memo, useEffect, useRef, useState } from "react";
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

export type FeedSearchDraftFieldProps = {
  committedQuery: string;
  onSubmitQuery: (q: string) => void;
  /** When set, runs after `debounceMs` of no typing. Do not open modals from here for the inline feed field or focus will be stolen. */
  onDebouncedQuery?: (q: string) => void;
  debounceMs?: number;
  onClearCommitted?: () => void;
  marginBottom?: number;
  feedSearchFs: number;
  searchIconSize: number;
  clearIconSize?: number;
  placeholder: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
};

/**
 * Draft text stays in this subtree so parent list headers do not re-render each keystroke.
 * Only clears local text from `committedQuery` when the parent clears the committed string (avoids
 * overwriting the draft when the parent updates from debounced search).
 */
function FeedSearchDraftFieldInner({
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
}: FeedSearchDraftFieldProps) {
  const [text, setText] = useState(committedQuery);
  const prevCommitted = useRef(committedQuery);

  useEffect(() => {
    if (committedQuery === "" && prevCommitted.current !== "") {
      setText("");
    }
    prevCommitted.current = committedQuery;
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
        blurOnSubmit={false}
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

export const FeedSearchDraftField = memo(FeedSearchDraftFieldInner);
