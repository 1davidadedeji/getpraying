import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { clamp } from "@/lib/responsiveMetrics";

export default function NotFoundScreen() {
  const { uiScale } = useResponsiveLayout();
  const pad = Math.round(clamp(20 * uiScale, 16, 26));
  const fsTitle = Math.round(clamp(20 * uiScale, 18, 24));
  const linkMt = Math.round(clamp(15 * uiScale, 12, 18));
  const linkPadV = Math.round(clamp(15 * uiScale, 12, 18));
  const fsLink = Math.round(clamp(14 * uiScale, 13, 16));

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.container, { padding: pad }]}>
        <Text style={[styles.title, { fontSize: fsTitle }]}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={[styles.link, { marginTop: linkMt, paddingVertical: linkPadV }]}>
          <Text style={[styles.linkText, { fontSize: fsLink }]}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "bold",
  },
  link: {},
  linkText: {
    color: "#2e78b7",
  },
});
