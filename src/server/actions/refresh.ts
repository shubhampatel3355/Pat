import "server-only";
import { refresh as nextRefresh } from "next/cache";
import { inMobileApi } from "../mobile/context";

/**
 * next/cache's refresh(): re-renders the browser's page after a Server Action. The mobile API runs the same
 * actions from a route handler, where Next.js refuses refresh(); the app refetches its own data instead.
 */
export function refresh(): void {
  if (!inMobileApi()) nextRefresh();
}
