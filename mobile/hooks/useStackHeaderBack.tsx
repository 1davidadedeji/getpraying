import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { Pressable } from "react-native";
import colors from "@/constants/colors";
import { goBackOrFallback } from "@/lib/goBackOrFallback";

/** Reliable stack back with Native Tabs / Expo Router (avoids noop system back). */
export function useStackHeaderBack(fallback: Href) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => goBackOrFallback(fallback)}
          hitSlop={14}
          style={{ paddingVertical: 8, paddingRight: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, fallback]);
}
