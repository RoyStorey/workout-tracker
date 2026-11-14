"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Tells the server the viewer's time zone so "today" matches their clock. */
export function TzSync() {
  const router = useRouter();
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const current = document.cookie.match(/(?:^|; )rr_tz=([^;]*)/)?.[1];
      if (tz && decodeURIComponent(current ?? "") !== tz) {
        document.cookie = `rr_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }
    } catch {}
  }, [router]);
  return null;
}
