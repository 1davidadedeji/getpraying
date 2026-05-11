"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CenterSpinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/dashboard");
    else router.replace("/login");
  }, [user, loading, router]);

  return <CenterSpinner />;
}
