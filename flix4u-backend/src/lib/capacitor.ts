import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export async function initCapacitorNativeUI(): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return;

    await Promise.allSettled([
      StatusBar.setOverlaysWebView({ overlay: false }),
      StatusBar.setStyle({ style: Style.Dark }),
      StatusBar.setBackgroundColor({ color: '#08090d' }),
      SplashScreen.hide({ fadeOutDuration: 150 }),
    ]);
  } catch {
    // No-op in web browsers / SSR
  }
}
