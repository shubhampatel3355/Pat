"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** The id of the row to highlight. It clears itself after a moment, so setting it makes the row glow once. */
export function useFreshRow(initial: string | null = null) {
  const [fresh, setFresh] = useState(initial);
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 1400);
    return () => clearTimeout(t);
  }, [fresh]);
  return [fresh, setFresh] as const;
}

/**
 * Deep links (?focus=id from ⌘K and notifications, ?new=1 from quick-create, ?lead=id from WIP): the screen reads them
 * in its initial state, and this scrolls to the row (`${rowPrefix}-${id}`, when given) and cleans them out of the URL.
 */
export function useDeepLink(path: string, rowPrefix?: string) {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const focus = params.get("focus");
    if (focus && rowPrefix) document.getElementById(`${rowPrefix}-${focus}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (focus !== null || params.has("new") || params.has("lead")) router.replace(path, { scroll: false });
  }, [params, router, path, rowPrefix]);
}
