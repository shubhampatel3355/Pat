import { useSyncExternalStore } from "react";
import { storage } from "./storage";

/**
 * Company / Partner view for owners and admins (the web keeps it in a cookie; the app on the device).
 * "company" or a partner's user id; the server ignores it for anyone who may not switch.
 */
const KEY = "pm.view";
let view = "company";
const listeners = new Set<() => void>();

void storage
  .get(KEY)
  .then((saved) => {
    if (saved) {
      view = saved;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => undefined);

export function setView(next: string) {
  view = next;
  listeners.forEach((l) => l());
  void storage.set(KEY, next).catch(() => undefined);
}

export function useView(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => view,
  );
}
