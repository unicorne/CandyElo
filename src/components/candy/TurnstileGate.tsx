"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement | string,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
          size?: "normal" | "compact" | "invisible" | "flexible";
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const STORAGE_KEY = "ce_human_v1";

type Props = {
  children: React.ReactNode;
};

export function TurnstileGate({ children }: Props) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const widgetEl = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    // Without site key, no challenge — issue dev cookie via POST and continue.
    if (!SITE_KEY) {
      fetch("/api/turnstile", { method: "POST", body: "{}" })
        .then(() => setVerified(true))
        .catch(() => setVerified(true));
      return;
    }
    if (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) {
      setVerified(true);
      return;
    }
    setVerified(false);
  }, []);

  useEffect(() => {
    if (verified !== false || !SITE_KEY) return;

    function tryRender() {
      if (!window.turnstile || !widgetEl.current) return false;
      widgetId.current = window.turnstile.render(widgetEl.current, {
        sitekey: SITE_KEY!,
        size: "flexible",
        appearance: "interaction-only",
        callback: async (token) => {
          try {
            const res = await fetch("/api/turnstile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            if (res.ok) {
              localStorage.setItem(STORAGE_KEY, "1");
              setVerified(true);
            }
          } catch {
            // ignore; widget will offer retry
          }
        },
      });
      return true;
    }

    if (window.turnstile) {
      tryRender();
      return;
    }
    const id = window.setInterval(() => {
      if (tryRender()) window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, [verified]);

  if (verified === null) return null; // tiny initial flicker
  if (verified) return <>{children}</>;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center gap-4">
      <p className="text-sm text-muted-foreground">
        Kurz prüfen, dass du kein Bot bist…
      </p>
      <div ref={widgetEl} />
    </div>
  );
}
