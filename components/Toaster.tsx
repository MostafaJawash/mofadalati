"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string; kind: "success" | "error" };

const EVENT = "mofadalati:toast";

export function toast(text: string, kind: Toast["kind"] = "success") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, kind } }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let next = 0;
    function onToast(e: Event) {
      const { text, kind } = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++next;
      setToasts((t) => [...t, { id, text, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div aria-live="polite" className="fixed bottom-4 inset-x-4 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg max-w-md ${
            t.kind === "error" ? "bg-danger text-white" : "bg-foreground text-background"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
