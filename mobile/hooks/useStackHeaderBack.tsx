import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
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
          style={styles.hitArea}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.primary}
            style={styles.iconNudge}
          />
        </Pressable>
      ),
    });
  }, [navigation, fallback]);
}

const styles = StyleSheet.create({
  hitArea: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -1,
  },
  iconNudge: {
    transform: [{ translateX: -1 }, { translateY: -4 }],
  },
});
