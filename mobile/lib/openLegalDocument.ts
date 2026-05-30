import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

/** Opens Terms / Privacy in an in-app browser with system-browser fallback. */
export async function openLegalDocument(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch {
      /* ignore */
    }
  }
}
