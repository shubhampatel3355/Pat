import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Small key-value store for the session token and preferences: the device keychain (expo-secure-store) on
 * iOS and Android. expo-secure-store has no web implementation, so the web build (used only for testing)
 * falls back to localStorage, as Expo's authentication guide does.
 */
const web = Platform.OS === "web";

export const storage = {
  async get(key: string): Promise<string | null> {
    if (web) return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (web) globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (web) globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
