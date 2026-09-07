import { Platform, StatusBar, Dimensions } from 'react-native';

/**
 * Native, zero-dependency safe insets for Android and iOS.
 * - Top: Automatically uses Android's native `StatusBar.currentHeight`
 * - Bottom: Elevates controls above Android's 3-button navigation bar (square, circle, triangle)
 *   and modern edge-to-edge transparent navigation bar.
 */
export function useAppInsets() {
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
  
  let bottomInset = 0;
  if (Platform.OS === 'android') {
    try {
      const screenHeight = Dimensions.get('screen').height;
      const windowHeight = Dimensions.get('window').height;
      const navBarHiddenByOs = screenHeight - windowHeight >= 36;
      
      // On edge-to-edge Android, the window stretches behind the system navigation bar.
      // 3-button navigation bar requires ~48dp padding to prevent overlapping dock buttons.
      bottomInset = navBarHiddenByOs ? 8 : 48;
    } catch {
      bottomInset = 48;
    }
  } else if (Platform.OS === 'ios') {
    bottomInset = 20;
  }

  return {
    top: topInset,
    bottom: bottomInset,
    topInset,
    bottomInset,
  };
}

