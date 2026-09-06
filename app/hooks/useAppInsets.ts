import { Platform, StatusBar } from 'react-native';

/**
 * Native, zero-dependency safe insets for Android and iOS.
 * - Top: Automatically uses Android's native `StatusBar.currentHeight`
 * - Bottom: Elevates controls above Android's 3-button navigation bar (triangle, circle, square)
 */
export function useAppInsets() {
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
  const bottomInset = 0;

  return {
    top: topInset,
    bottom: bottomInset,
    topInset,
    bottomInset,
  };
}
