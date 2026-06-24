import { InteractionManager } from "react-native";
import { showAppAlert } from "@/components/AppAlert";
import { blockUser } from "@/lib/blockUser";
import { publishUserBlocked } from "@/lib/postEngagementSync";
import { submitPostReport } from "@/lib/reportPost";

export const POST_REPORT_REASONS = [
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "harassment", label: "Harassment or hate" },
  { id: "spam", label: "Spam or misleading" },
] as const;

type PostSafetyOptions = {
  postId: number;
  authorUsername?: string | null;
  token: string | null;
  onReported?: () => void;
  onBlocked?: () => void;
};

/** Wait for the alert modal to finish dismissing before opening another or mutating heavy UI state. */
function afterAlertDismiss(fn: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(fn, 400);
  });
}

function showReportReasonPicker(
  postId: number,
  token: string | null,
  onReported?: () => void,
): void {
  showAppAlert({
    title: "Why are you reporting this?",
    message: "Our team will review this prayer.",
    buttons: [
      { text: "Cancel", style: "cancel" },
      ...POST_REPORT_REASONS.map((reason) => ({
        text: reason.label,
        onPress: () => {
          afterAlertDismiss(() => {
            void (async () => {
              const result = await submitPostReport(postId, token, reason.id);
              if (result.ok) {
                afterAlertDismiss(() => {
                  showAppAlert({ title: "Report submitted", message: result.message });
                  onReported?.();
                });
              } else {
                afterAlertDismiss(() => {
                  showAppAlert({ title: "Could not submit report", message: result.error });
                });
              }
            })();
          });
        },
      })),
    ],
  });
}

function confirmBlockUser(
  username: string,
  token: string | null,
  onBlocked?: () => void,
): void {
  showAppAlert({
    title: "Block this user?",
    message: `You will no longer see prayers from @${username} in your feed.`,
    buttons: [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          afterAlertDismiss(() => {
            void (async () => {
              const result = await blockUser(username, token);
              if (!result.ok) {
                afterAlertDismiss(() => {
                  showAppAlert({ title: "Could not block user", message: result.error });
                });
                return;
              }
              afterAlertDismiss(() => {
                publishUserBlocked(username);
                onBlocked?.();
              });
            })();
          });
        },
      },
    ],
  });
}

export function showPostSafetyMenu(opts: PostSafetyOptions): void {
  const { postId, authorUsername, token, onReported, onBlocked } = opts;
  const canBlock = Boolean(authorUsername?.trim());

  showAppAlert({
    title: "Report or block",
    message: "Help keep the community safe.",
    buttons: [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report prayer",
        onPress: () => {
          afterAlertDismiss(() => {
            showReportReasonPicker(postId, token, onReported);
          });
        },
      },
      ...(canBlock
        ? [
            {
              text: "Block user",
              style: "destructive" as const,
              onPress: () => {
                const username = authorUsername!.trim();
                afterAlertDismiss(() => {
                  confirmBlockUser(username, token, onBlocked);
                });
              },
            },
          ]
        : []),
    ],
  });
}
