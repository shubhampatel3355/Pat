import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";
import { colors, fonts } from "@/theme/tokens";

const variants = StyleSheet.create({
  display: { fontFamily: fonts.bold, fontSize: 46, lineHeight: 50, letterSpacing: -1.2, color: colors.text },
  title: { fontFamily: fonts.medium, fontSize: 28, lineHeight: 33, letterSpacing: -0.5, color: colors.text },
  h1: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: colors.text },
  h2: { fontFamily: fonts.medium, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, color: colors.text },
  h3: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  strong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.muted },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, color: colors.muted, textTransform: "uppercase" },
  number: { fontFamily: fonts.regular, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: colors.text },
});

export type TextVariant = keyof typeof variants;

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
  weight?: keyof typeof fonts;
  align?: TextStyle["textAlign"];
}

/** App text: Urbanist in the prototype's sizes. */
export function T({ variant = "body", color, weight, align, style, ...rest }: Props) {
  return <Text {...rest} style={[variants[variant], color ? { color } : null, weight ? { fontFamily: fonts[weight] } : null, align ? { textAlign: align } : null, style]} />;
}
