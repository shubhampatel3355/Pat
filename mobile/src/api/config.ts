import { storage } from "@/lib/storage";

/**
 * Where the backend lives. Defaults to EXPO_PUBLIC_API_URL (see .env.example), else production. Someone
 * testing against a local web app can change it on the sign-in screen; the choice is remembered.
 */
const DEFAULT_URL = normaliseApiUrl(process.env.EXPO_PUBLIC_API_URL || "https://os.patmichaels.com");
const KEY = "pm.apiUrl";

let current = DEFAULT_URL;

export function normaliseApiUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_URL;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function loadApiUrl(): Promise<string> {
  try {
    const saved = await storage.get(KEY);
    if (saved) current = normaliseApiUrl(saved);
  } catch {
    // Keychain unavailable: use the default.
  }
  return current;
}

export function apiUrl(): string {
  return current;
}

export function defaultApiUrl(): string {
  return DEFAULT_URL;
}

export async function saveApiUrl(url: string | null): Promise<void> {
  current = url ? normaliseApiUrl(url) : DEFAULT_URL;
  if (current === DEFAULT_URL) await storage.remove(KEY);
  else await storage.set(KEY, current);
}

/** "os.patmichaels.com" for display. */
export function apiHost(): string {
  return current.replace(/^https?:\/\//, "");
}
