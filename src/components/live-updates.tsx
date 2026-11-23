"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the page in sync with the server in real time. When anyone changes one of
 * the watched challenges, the server pushes a ping and we re-render from fresh data.
 * Client-side state (what you've typed, open menus) is preserved.
 */
export function LiveUpdates({ ids, inviteKey, renderedAt }: { ids: number[]; inviteKey?: string; renderedAt: number }) {
  const router = useRouter();
  const [down, setDown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idKey = ids.join(",");

  useEffect(() => {
    if (!idKey) return;
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 150); // batch bursts of logs
    };
    const qs = new URLSearchParams({ ids: idKey, since: String(renderedAt), ...(inviteKey ? { k: inviteKey } : {}) });
    let lostConnection = false;
    let es: EventSource | null = null;

    const connect = () => {
      es?.close();
      es = new EventSource(`/api/live?${qs}`);
      es.onmessage = refresh;
      es.onopen = () => {
        setDown(false);
        // Anything could have changed while we were offline.
        if (lostConnection) refresh();
        lostConnection = false;
      };
      es.onerror = () => {
        lostConnection = true;
        // Only complain if it stays down; brief blips reconnect on their own.
        setTimeout(() => {
          if (es?.readyState !== EventSource.OPEN) setDown(true);
        }, 4000);
      };
    };
    connect();

    // Phones suspend background tabs; catch up as soon as the page is visible again.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!es || es.readyState === EventSource.CLOSED) connect();
      refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      es?.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [idKey, inviteKey, renderedAt, router]);

  if (!down) return null;
  return (
    <div role="status" className="fixed left-1/2 top-16 z-40 -translate-x-1/2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-ink shadow-lg">
      Live updates paused. Reconnecting…
    </div>
  );
}
