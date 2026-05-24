import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Linking } from "react-native";
import { showAppAlert } from "@/components/AppAlert";

type PermissionLike = {
  granted: boolean;
  canAskAgain?: boolean;
};

function showDeniedAlert(title: string, message: string, canAskAgain: boolean): void {
  if (canAskAgain) {
    showAppAlert({ title, message });
    return;
  }
  showAppAlert({
    title,
    message: `${message} You can turn this on in Settings.`,
    buttons: [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => void Linking.openSettings() },
    ],
  });
}

async function resolvePermission(
  getCurrent: () => Promise<PermissionLike>,
  request: () => Promise<PermissionLike>,
  title: string,
  message: string,
): Promise<boolean> {
  let current = await getCurrent();
  if (current.granted) return true;

  if (current.canAskAgain !== false) {
    current = await request();
    if (current.granted) return true;
  }

  showDeniedAlert(title, message, current.canAskAgain !== false);
  return false;
}

/** Photo/video library access via expo-image-picker (create post, avatar, etc.). */
export async function ensurePhotoLibraryPermission(message: string): Promise<boolean> {
  return resolvePermission(
    () => ImagePicker.getMediaLibraryPermissionsAsync(),
    () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    "Permission needed",
    message,
  );
}

/** Audio/media library browsing via expo-media-library. */
export async function ensureMediaLibraryPermission(message: string): Promise<boolean> {
  return resolvePermission(
    () => MediaLibrary.getPermissionsAsync(),
    () => MediaLibrary.requestPermissionsAsync(),
    "Permission needed",
    message,
  );
}
