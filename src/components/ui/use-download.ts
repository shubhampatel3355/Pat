"use client";

import { useCallback, useState } from "react";
import { useToast } from "./toast";

/**
 * Download a generated file (PDF, XLSX) with fetch so a failure — rate limit, render error — shows
 * the server's message in a toast instead of being saved as a broken file.
 */
export function useDownload() {
  const { show } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const download = useCallback(
    async (url: string, fallbackName: string, key: string = url) => {
      setPending(key);
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          show(body?.error ?? "The file could not be downloaded. Try again shortly.", "error");
          return;
        }
        const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
        const href = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = href;
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
      } catch {
        show("Network problem — please try again.", "error");
      } finally {
        setPending(null);
      }
    },
    [show],
  );

  return { download, pending };
}
