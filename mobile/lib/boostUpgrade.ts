import { showAppAlert } from "@/components/AppAlert";

export function showBoostUpgradePrompt(upgrade: () => Promise<void>): void {
  showAppAlert({
    title: "Boost unavailable during trial",
    message:
      "Boosting prayers is only available to fully paid subscribers. Upgrade your plan now to unlock Boost.",
    buttons: [
      { text: "Not now", style: "cancel" },
      {
        text: "Upgrade now",
        onPress: () => {
          void upgrade().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Could not start upgrade.";
            showAppAlert({ title: "Upgrade not completed", message: msg });
          });
        },
      },
    ],
  });
}
