import { showAppAlert } from "@/components/AppAlert";
import { blockUser } from "@/lib/blockUser";
import { publishUserBlocked } from "@/lib/postEngagementSync";
import { submitPostReport } from "@/lib/reportPost";

type PostSafetyOptions = {
  postId: number;
  authorUsername?: string | null;
  token: string | null;
  onReported?: () => void;
  onBlocked?: () => void;
};

export function showPostSafetyMenu(opts: PostSafetyOptions): void {
  const { postId, authorUsername, token, onReported, onBlocked } = opts;
  const canBlock = Boolean(authorUsername?.trim());

  showAppAlert({
    title: "Safety",
    message: "Report content or block the author from your feed.",
    buttons: [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        onPress: () => {
          void (async () => {
            const result = await submitPostReport(postId, token);
            if (result.ok) {
              showAppAlert({ title: "Report submitted", message: result.message });
              onReported?.();
            } else {
              showAppAlert({ title: "Could not submit report", message: result.error });
            }
          })();
        },
      },
      ...(canBlock
        ? [
            {
              text: "Block user",
              style: "destructive" as const,
              onPress: () => {
                const username = authorUsername!.trim();
                showAppAlert({
                  title: "Block this user?",
                  message: `You will no longer see prayers from @${username} in your feed.`,
                  buttons: [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Block",
                      style: "destructive",
                      onPress: () => {
                        void (async () => {
                          const result = await blockUser(username, token);
                          if (result.ok) {
                            publishUserBlocked(username);
                            showAppAlert({ title: "User blocked", message: result.message });
                            onBlocked?.();
                          } else {
                            showAppAlert({ title: "Could not block user", message: result.error });
                          }
                        })();
                      },
                    },
                  ],
                });
              },
            },
          ]
        : []),
    ],
  });
}
