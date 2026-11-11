/**
 * Design tokens from the mobile prototype (mobile.html): light grey canvas, soft grey cards, navy accents,
 * Urbanist type. Keep colours here; screens and components only reference these names.
 */
export const colors = {
  canvas: "#F2F2F2",
  card: "#E8E8E8",
  cardBorder: "rgba(0,0,0,0.04)",
  well: "#DCDCDC",
  wellBorder: "rgba(0,0,0,0.10)",
  text: "#1C1C1E",
  muted: "#55555A",
  faint: "#8E8E93",
  navy: "#023E7D",
  navyDeep: "#002855",
  navyNight: "#001233",
  steel: "#5C7FA8",
  sky: "#8AAEE0",
  ice: "#B1C9EF",
  mist: "#D5DEEF",
  danger: "#C93C37",
  dangerSoft: "#FF6B7A",
  success: "#2E7D44",
  successBright: "#42D6A4",
  warning: "#B7791F",
  white: "#FFFFFF",
  overlay: "rgba(0,18,51,0.5)",
  glass: "rgba(244,244,244,0.94)",
  glassBorder: "rgba(0,0,0,0.07)",
  input: "rgba(0,0,0,0.03)",
  inputBorder: "rgba(0,0,0,0.08)",
  chip: "rgba(0,0,0,0.05)",
  chipBorder: "rgba(0,0,0,0.06)",
  divider: "rgba(0,0,0,0.06)",
  track: "rgba(0,0,0,0.06)",
} as const;

/** The navy hero gradient (150deg #023E7D → #002855 → #001233). */
export const heroGradient = [colors.navy, colors.navyDeep, colors.navyNight] as const;
export const avatarGradient = ["#628ECB", "#395886"] as const;
/** Avatar tones for people and tenants, picked by name. */
export const tones = ["#023E7D", "#002855", "#2A5C99", "#1B4F8C", "#0A3A75"] as const;

export const radius = { sm: 12, md: 16, input: 15, lg: 20, card: 24, hero: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const fonts = {
  light: "Urbanist_300Light",
  regular: "Urbanist_400Regular",
  medium: "Urbanist_500Medium",
  semibold: "Urbanist_600SemiBold",
  bold: "Urbanist_700Bold",
} as const;

export const shadow = {
  card: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  button: { shadowColor: colors.navy, shadowOpacity: 0.32, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  hero: { shadowColor: colors.navyNight, shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 24 }, elevation: 8 },
} as const;

/** 18% alpha tint of a hex colour, for pill backgrounds (same rule as the web: colour + "2E"). */
export const tint = (hex: string, alpha = "2E") => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex);

export function toneFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return tones[h % tones.length]!;
}
