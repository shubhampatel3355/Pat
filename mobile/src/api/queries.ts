import { focusManager, QueryClient, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AppState } from "react-native";
import { useToast } from "@/components/toast";
import { api, errorText } from "./client";
import type {
  ActionResult,
  BdResponse,
  DashboardResponse,
  FinanceResponse,
  FollowUpsResponse,
  InvoicesResponse,
  LiveSnapshot,
  PayrollResponse,
  PayslipsResponse,
  SearchResponse,
  SettingsResponse,
  TeamsResponse,
  VaultFolderResponse,
  VaultResponse,
  VehiclesResponse,
  WipResponse,
} from "./types";

/**
 * Data sync. The app reads the same database as the web through the backend, so "real time" works the
 * web's way: screens refetch when opened and when the app returns to the foreground, every change
 * refreshes everything that may have moved, and notifications/activity poll every 15 seconds.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 10_000, gcTime: 10 * 60_000, retry: (count, error) => count < 2 && !/session|access|not found/i.test(errorText(error)), refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}

// React Query's "window focus" = app back in the foreground.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => sub.remove();
});

const M = "/api/mobile/v1";

function useScreen<T>(key: QueryKey, path: string, options: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery<T>({ queryKey: key, queryFn: ({ signal }) => api.get<T>(path, signal), ...options });
}

export const useDashboard = (view: string) => useScreen<DashboardResponse>(["dashboard", view], `${M}/dashboard?view=${encodeURIComponent(view)}`);
export const useWip = () => useScreen<WipResponse>(["wip"], `${M}/wip`);
export const useFollowUps = () => useScreen<FollowUpsResponse>(["follow-ups"], `${M}/follow-ups`);
export const useBd = () => useScreen<BdResponse>(["bd"], `${M}/bd`);
export const useVehicles = () => useScreen<VehiclesResponse>(["vehicles"], `${M}/vehicles`);
export const useFinance = (fy: number | null) => useScreen<FinanceResponse>(["finance", fy], `${M}/finance${fy ? `?fy=${fy}` : ""}`);
export const useInvoices = (leadId?: string | null) => useScreen<InvoicesResponse>(["invoices", leadId ?? null], `${M}/invoices${leadId ? `?lead=${leadId}` : ""}`);
export const usePayroll = () => useScreen<PayrollResponse>(["payroll"], `${M}/payroll`);
export const usePayslips = () => useScreen<PayslipsResponse>(["payslips"], `${M}/payslips`);
export const useTeams = () => useScreen<TeamsResponse>(["teams"], `${M}/teams`);
export const useVault = () => useScreen<VaultResponse>(["vault"], `${M}/vault`);
export const useVaultFolder = (slug: string) => useScreen<VaultFolderResponse>(["vault", slug], `${M}/vault/${encodeURIComponent(slug)}`);
export function useSettings(params: Record<string, string | number | null | undefined>) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return useScreen<SettingsResponse>(["settings", params], `${M}/settings${query ? `?${query}` : ""}`);
}
/** Notifications, team activity and new achievements: the web shell's 15-second poll. */
export const useLive = () => useScreen<LiveSnapshot>(["live"], "/api/live", { refetchInterval: 15_000 });
export const useSearch = (q: string) => useScreen<SearchResponse>(["search", q], `/api/search?q=${encodeURIComponent(q)}`, { enabled: q.trim().length >= 2 });

/**
 * Runs one of the web's server actions (src/server/mobile/actions.ts lists them). Success shows the action's
 * own message and refreshes every screen's data; failure shows its error. Forms read `fieldErrors` from the
 * returned result.
 */
export function useAction<I = unknown, R = unknown>(name: string, opts: { quiet?: boolean } = {}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: I) => api.post<ActionResult<R>>(`${M}/actions/${name}`, input),
    onSuccess: (result) => {
      if (result.ok) {
        if (!opts.quiet) toast.show(result.message || "Saved");
        void queryClient.invalidateQueries();
      } else {
        toast.show(result.error, "error");
      }
    },
    onError: (error) => toast.show(errorText(error), "error"),
  });
}

/** Fire an action from an event handler; resolves to its result (or a failed result when the request fails). */
export async function runAction<I, R>(mutation: { mutateAsync: (input: I) => Promise<ActionResult<R>> }, input: I): Promise<ActionResult<R>> {
  try {
    return await mutation.mutateAsync(input);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}
