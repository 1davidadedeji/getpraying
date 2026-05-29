"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";
import { apiUrl, authHeaders } from "@/lib/api";
import type { AdminPostDetail } from "@/lib/adminPostTypes";

export function useAdminPost(postId: number) {
  const { token } = useAuth();
  const [post, setPost] = useState<AdminPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(postId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/admin/posts/${postId}`), { headers: authHeaders(token) });
      if (!res.ok) {
        setPost(null);
        setError("Post not found");
        return;
      }
      setPost(await res.json());
    } catch {
      setPost(null);
      setError("Could not load post");
    } finally {
      setLoading(false);
    }
  }, [token, postId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { post, loading, error, reload: load };
}
