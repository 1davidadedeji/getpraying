import { showAppAlert } from "@/components/AppAlert";
import { router, type Href } from "expo-router";

export function showBoostUpgradePrompt(): void {
  showAppAlert({
    title: "Boost unavailable during trial",
    message:
      "Boosting prayers is only available to fully paid subscribers. Upgrade after your trial ends to unlock Boost.",
    buttons: [
      { text: "Not now", style: "cancel" },
      {
        text: "View plans",
        onPress: () => router.push("/(paywall)?soft=1" as Href),
      },
    ],
  });
}
