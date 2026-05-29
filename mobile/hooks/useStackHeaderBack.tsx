import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
          <View style={styles.circle}>
            <Ionicons
              name="chevron-back"
              size={28}
              color={colors.primary}
              style={styles.iconNudge}
            />
          </View>
        </Pressable>
      ),
    });
  }, [navigation, fallback]);
}

const styles = StyleSheet.create({
  hitArea: {
    paddingVertical: 8,
    paddingRight: 8,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconNudge: {
    marginLeft: -2,
  },
});
