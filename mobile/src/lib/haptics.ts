import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { storage } from "./storage";

/**
 * The app's vibrations, named by what happened rather than by motor pattern, so every screen feels the same:
 *
 *   tap      a button or icon button was pressed
 *   select   a choice changed: tab, chip, segment, an option in a list, a row that opens something
 *   toggle   a switch or checkbox flipped
 *   press    a heavier action: the + button
 *   success  an action worked (saved, completed, sent)
 *   warning  a decision that needs attention (delete, approve, sign out)
 *   error    an action failed
 *
 * Android uses the system haptics engine (View.performHapticFeedback), which follows the phone's own
 * "touch feedback" setting and needs no vibration permission; each type is only used on Android versions
 * that have it, because expo-haptics rejects newer ones. iOS uses the Taptic Engine, which is silent in Low
 * Power Mode or when system haptics are off. The web build stays silent. People can turn them off under More.
 */

const KEY = "pm.haptics";
const supported = Platform.OS === "ios" || Platform.OS === "android";
const androidApi = Platform.OS === "android" ? Number(Platform.Version) : 0;

let enabled = supported;
let last = { kind: "", at: 0 };

type Kind = "tap" | "select" | "toggleOn" | "toggleOff" | "press" | "success" | "warning" | "error";

const A = Haptics.AndroidHaptics;

function android(kind: Kind): Haptics.AndroidHaptics {
  switch (kind) {
    case "tap":
      return A.Virtual_Key;
    case "select":
      return androidApi >= 34 ? A.Segment_Tick : A.Clock_Tick;
    case "toggleOn":
      return androidApi >= 34 ? A.Toggle_On : A.Context_Click;
    case "toggleOff":
      return androidApi >= 34 ? A.Toggle_Off : A.Clock_Tick;
    case "press":
      return androidApi >= 27 ? A.Keyboard_Press : A.Virtual_Key;
    case "success":
      return androidApi >= 30 ? A.Confirm : A.Virtual_Key;
    case "warning":
      return A.Long_Press;
    case "error":
      return androidApi >= 30 ? A.Reject : A.Long_Press;
  }
}

function ios(kind: Kind): Promise<void> {
  switch (kind) {
    case "tap":
    case "toggleOn":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case "select":
    case "toggleOff":
      return Haptics.selectionAsync();
    case "press":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case "success":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case "warning":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case "error":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

function play(kind: Kind) {
  if (!enabled) return;
  // One touch can reach two handlers (a row and the button inside it): vibrate once.
  const now = Date.now();
  if (last.kind === kind && now - last.at < 60) return;
  last = { kind, at: now };
  const done = Platform.OS === "android" ? Haptics.performAndroidHapticsAsync(android(kind)) : ios(kind);
  void done.catch(() => undefined);
}

export const haptics = {
  tap: () => play("tap"),
  select: () => play("select"),
  toggle: (on: boolean) => play(on ? "toggleOn" : "toggleOff"),
  press: () => play("press"),
  success: () => play("success"),
  warning: () => play("warning"),
  error: () => play("error"),
};

export type HapticKind = Exclude<keyof typeof haptics, "toggle">;

/** Whether this device can vibrate for the app at all (false on the web build). */
export const hapticsSupported = supported;

export function hapticsEnabled(): boolean {
  return enabled;
}

/** Reads the saved choice; call once at start-up. On by default. */
export async function loadHapticsPreference(): Promise<void> {
  if (!supported) return;
  try {
    enabled = (await storage.get(KEY)) !== "off";
  } catch {
    enabled = true;
  }
}

export async function setHapticsEnabled(on: boolean): Promise<void> {
  enabled = supported && on;
  await storage.set(KEY, on ? "on" : "off");
}
