import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/tokens";

/** One icon vocabulary for the app (Ionicons outline set, close to the prototype's iOS glyphs). */
const GLYPHS = {
  home: "home-outline",
  building: "business-outline",
  trend: "trending-up-outline",
  calendar: "calendar-outline",
  calendarCheck: "calendar-clear-outline",
  grid: "grid-outline",
  search: "search-outline",
  bell: "notifications-outline",
  sliders: "options-outline",
  close: "close",
  back: "chevron-back",
  forward: "chevron-forward",
  down: "chevron-down",
  plus: "add",
  phone: "call-outline",
  whatsapp: "logo-whatsapp",
  mail: "mail-outline",
  user: "person-outline",
  users: "people-outline",
  userAdd: "person-add-outline",
  car: "car-outline",
  wallet: "wallet-outline",
  file: "document-text-outline",
  lock: "lock-closed-outline",
  settings: "settings-outline",
  rupee: "cash-outline",
  chart: "stats-chart-outline",
  check: "checkmark",
  checkCircle: "checkmark-circle-outline",
  circle: "ellipse-outline",
  clock: "time-outline",
  alert: "alert-circle-outline",
  location: "location-outline",
  navigate: "navigate-outline",
  download: "download-outline",
  share: "share-outline",
  trash: "trash-outline",
  edit: "create-outline",
  send: "send-outline",
  upload: "cloud-upload-outline",
  folder: "folder-outline",
  eye: "eye-outline",
  eyeOff: "eye-off-outline",
  logout: "log-out-outline",
  swap: "swap-horizontal-outline",
  receipt: "receipt-outline",
  briefcase: "briefcase-outline",
  trophy: "trophy-outline",
  flag: "flag-outline",
  refresh: "refresh-outline",
  message: "chatbubble-outline",
  key: "key-outline",
  server: "server-outline",
  globe: "globe-outline",
  target: "radio-button-on-outline",
  star: "star",
  starOutline: "star-outline",
  pause: "pause-circle-outline",
  layers: "layers-outline",
  shield: "shield-checkmark-outline",
  link: "link-outline",
  more: "ellipsis-horizontal",
  sparkles: "sparkles-outline",
} as const satisfies Record<string, keyof typeof Ionicons.glyphMap>;

export type IconName = keyof typeof GLYPHS;

/** Web menu icon names (src/server/nav.ts) → app icons. */
const WEB_ICONS: Record<string, IconName> = {
  dashboard: "home",
  leads: "building",
  followups: "calendarCheck",
  bizdev: "briefcase",
  car: "car",
  finance: "chart",
  invoice: "receipt",
  payroll: "rupee",
  mypay: "wallet",
  teams: "users",
  vault: "lock",
  settings: "settings",
  phone: "phone",
  user: "user",
};

export function iconForWeb(name: string): IconName {
  return WEB_ICONS[name] ?? "grid";
}

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={GLYPHS[name]} size={size} color={color} />;
}
