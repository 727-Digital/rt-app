import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.reliableturf.app',
  appName: 'Reliable Turf',
  webDir: 'dist',
  server: {
    // Load the app from production web instead of the bundled dist snapshot.
    // Every Vercel deploy now reaches the iOS app instantly — no Xcode
    // rebuild required for content/UI changes. The Capacitor bridge is still
    // injected by the WKWebView, so native plugins (push, biometrics, status
    // bar, etc.) keep working.
    url: 'https://app.reliableturf.com',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
