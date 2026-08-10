"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";

export function useAdminPostPremium(
  postId: number,
  token: string | null,
  initialPremium: boolean | undefined,
  reload?: () => Promise<void>,
) {
  const [isPremium, setIsPremium] = useState(false);
  const [premiumSaving, setPremiumSaving] = useState(false);
  const [premiumError, setPremiumError] = useState<string | null>(null);

  useEffect(() => {
    setIsPremium(initialPremium ?? false);
  }, [initialPremium]);

  const savePremium = useCallback(
    async (next: boolean) => {
      if (!token) return;
      setPremiumSaving(true);
      setPremiumError(null);
      const prev = isPremium;
      setIsPremium(next);
      try {
        const res = await adminFetch(`/admin/posts/${postId}/premium`, token, {
          method: "PATCH",
          body: JSON.stringify({ isPremium: next }),
        });
        if (!res.ok) {
          setIsPremium(prev);
          setPremiumError("Could not update premium flag");
          return;
        }
        await reload?.();
      } catch {
        setIsPremium(prev);
        setPremiumError("Could not update premium flag");
      } finally {
        setPremiumSaving(false);
      }
    },
    [isPremium, postId, reload, token],
  );

  return { isPremium, premiumSaving, premiumError, savePremium, setPremiumError };
}
