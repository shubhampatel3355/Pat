import { Alert, type AlertButton } from "react-native";
import { haptics } from "./haptics";

/** The system confirmation dialog for a decision that changes data (delete, approve, sign out), with a warning vibration. */
export function confirmAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  haptics.warning();
  Alert.alert(title, message, buttons);
}
