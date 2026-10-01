"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const INTERVAL_MS = 3000;

/**
 * Keeps every open page in sync with the shared database: polls the revision
 * counter and re-renders server data whenever anyone changes anything.
 */
export function SyncWatcher() {
  const router = useRouter();
  const revision = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/sync", { cache: "no-store" });
        if (!res.ok) return;
        const { revision: latest } = (await res.json()) as { revision: number };
        if (stopped) return;
        if (revision.current !== null && latest !== revision.current) router.refresh();
        revision.current = latest;
      } catch {
        // Offline or server restarting; try again on the next tick.
      }
    }

    check();
    const timer = setInterval(check, INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [router]);

  return null;
}
