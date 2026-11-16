import { useEffect, useRef, useState } from "react";
import { Pressable, type LayoutChangeEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut, interpolate, LayoutAnimationConfig, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptics, type HapticKind } from "@/lib/haptics";

/**
 * The app's motion: quick, springy, never slow. Everything here animates on the UI thread (Reanimated), so it
 * stays smooth at the display's full refresh rate even while JavaScript is busy, and it follows the system's
 * Reduce Motion setting (Reanimated's default).
 */
export const motion = {
  pressIn: { duration: 90 },
  release: { damping: 16, stiffness: 340, mass: 0.6 },
  slide: { damping: 22, stiffness: 260, mass: 0.8 },
  sheet: { damping: 24, stiffness: 230, mass: 0.9 },
} as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, "style" | "children"> {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Size while held (1 keeps it still). */
  scaleTo?: number;
  /** Opacity while held. */
  pressedOpacity?: number;
  /** Vibration when the press completes; "none" for controls that vibrate themselves. */
  haptic?: HapticKind | "none";
}

/**
 * Pressable that sinks slightly under the finger and springs back, then vibrates once the tap completes
 * (not on touch-down, so starting a scroll on top of it never buzzes).
 */
export function PressableScale({ style, children, scaleTo = 0.97, pressedOpacity = 1, haptic = "tap", onPressIn, onPressOut, onPress, ...rest }: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.get(), [0, 1], [1, pressedOpacity]),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, scaleTo]) }],
  }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        pressed.set(withTiming(1, motion.pressIn));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withSpring(0, motion.release));
        onPressOut?.(e);
      }}
      onPress={
        onPress
          ? (e) => {
              if (haptic !== "none") haptics[haptic]();
              onPress(e);
            }
          : undefined
      }
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * A pill that slides behind the selected one of `count` equal-width items laid out in a row (tab bar,
 * segmented control). `inset` is the row's border plus horizontal padding on each side; `gap` the space
 * between items. Spread `onLayout` on the row and put `pill` on an absolutely positioned view.
 */
export function useSlidingPill(count: number, index: number, gap: number, inset: number) {
  const [width, setWidth] = useState(0);
  const slot = count > 0 && width > 0 ? (width - 2 * inset - gap * (count - 1)) / count : 0;
  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!slot || index < 0) return;
    const target = index * (slot + gap);
    // The first placement jumps; later ones glide.
    x.set(placed.current ? withSpring(target, motion.slide) : target);
    placed.current = true;
  }, [slot, index, gap, x]);
  const glide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return {
    onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width),
    pill: [{ width: slot, opacity: slot > 0 && index >= 0 ? 1 : 0 }, glide],
  };
}

/** Rows that come and go (to-dos, tasks, follow-ups): they fade in and out and the others glide into place. */
const rowLayout = LinearTransition.springify().damping(22).stiffness(240);

export function MotionRow({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View layout={rowLayout} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
      {children}
    </Animated.View>
  );
}

/** Wraps a list of MotionRows: rows already there when the screen opens appear at once, later ones fade in. */
export function MotionList({ children }: { children: React.ReactNode }) {
  return <LayoutAnimationConfig skipEntering>{children}</LayoutAnimationConfig>;
}
