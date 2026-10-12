"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { TranslateBox } from "@/features/translation/components/translate-box";

/** The translator, counting usage and refreshing the meters after each use. */
export function DashboardTranslate() {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  return <TranslateBox countUsage onTranslated={refresh} />;
}
